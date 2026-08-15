// @vitest-environment node
/**
 * O diário de requisições: uma linha JSON por requisição, com o que entrou, o que saiu e toda
 * chamada externa que ela disparou.
 */
import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import supertest from 'supertest'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { NotFound } from '../../exceptions/errors.js'
import { HttpErrorFilter } from '../../filters/http-error.filter.js'
import { installRequestLog, logDir, type RequestEntry } from '../request-log.interceptor.js'

/** O serviço externo que a requisição chama: é o que aparece em `outbound`. */
let remote: Server
let remoteUrl: string
let app: INestApplication
let http: ReturnType<typeof supertest>
let root: string
let previousRoot: string | undefined

@Controller('exemplo')
class ExemploController {
    @Post('chama')
    async chama(@Body() body: Record<string, unknown>): Promise<unknown> {
        const response = await fetch(`${remoteUrl}/modelo`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: 'Bearer sk-secreta' },
            body: JSON.stringify({ prompt: body.prompt })
        })

        return { echo: await response.json() }
    }

    @Get('quebra')
    quebra(): never {
        throw new NotFound('Não encontrado.')
    }

    /** O caminho do modelo: a resposta chega em pedaços, um token por linha. */
    @Post('stream')
    async stream(): Promise<unknown> {
        const response = await fetch(`${remoteUrl}/stream`, { method: 'POST', body: '{}' })

        return { texto: await response.text() }
    }

    @Post('quieto')
    quieto(@Body() body: Record<string, unknown>): unknown {
        return { recebido: Object.keys(body).length }
    }
}

beforeEach(async () => {
    previousRoot = process.env.ACUTIS_PROJECTS_PATH
    root = mkdtempSync(join(tmpdir(), 'acutis-log-'))
    process.env.ACUTIS_PROJECTS_PATH = root

    remote = createServer((request, response) => {
        // O formato do Ollama: um JSON por linha, cada um com um pedaço do texto.
        if (request.url === '/stream') {
            response.writeHead(200, { 'content-type': 'application/x-ndjson' })
            response.end([
                JSON.stringify({ message: { role: 'assistant', content: '{"gher' }, done: false }),
                JSON.stringify({ message: { role: 'assistant', content: 'kin": "oi"}' }, done: false }),
                JSON.stringify({ message: { role: 'assistant', content: '' }, done: true })
            ].join('\n'))

            return
        }

        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ resposta: 'ok' }))
    })

    await new Promise<void>((resolve) => remote.listen(0, '127.0.0.1', resolve))

    const port = (remote.address() as { port: number }).port
    remoteUrl = `http://127.0.0.1:${port}`

    const moduleRef = await Test.createTestingModule({ controllers: [ExemploController] }).compile()

    app = moduleRef.createNestApplication()
    app.useGlobalFilters(new HttpErrorFilter())
    installRequestLog(app)

    await app.init()

    http = supertest(app.getHttpServer())
})

afterEach(async () => {
    await app.close()
    await new Promise<void>((resolve) => remote.close(() => resolve()))

    if (previousRoot === undefined) {
        delete process.env.ACUTIS_PROJECTS_PATH
    } else {
        process.env.ACUTIS_PROJECTS_PATH = previousRoot
    }

    rmSync(root, { recursive: true, force: true })
})

/** As linhas escritas até agora, já desserializadas. */
function entries(): RequestEntry[] {
    const files = readdirSync(logDir())

    return files.flatMap((file) => readFileSync(join(logDir(), file), 'utf8')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as RequestEntry))
}

it('escreve uma linha por requisição, com rota, status, duração e os dois payloads', async () => {
    await http.post('/exemplo/quieto').send({ nome: 'acutis' }).expect(201)

    const [entry] = entries()

    expect(entries()).toHaveLength(1)
    expect(entry!.method).toBe('POST')
    expect(entry!.url).toBe('/exemplo/quieto')
    expect(entry!.status).toBe(201)
    expect(entry!.durationMs).toBeGreaterThanOrEqual(0)
    expect(entry!.request.body).toEqual({ nome: 'acutis' })
    expect(entry!.response.body).toEqual({ recebido: 1 })
})

/** O identificador é como se fala de uma requisição específica depois — no jq, no relatório, aqui. */
it('dá um identificador único a cada requisição', async () => {
    await http.post('/exemplo/quieto').send({ nome: 'um' }).expect(201)
    await http.post('/exemplo/quieto').send({ nome: 'dois' }).expect(201)

    const [primeira, segunda] = entries()

    expect(primeira!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(segunda!.id).not.toBe(primeira!.id)
})

it('remonta a resposta que o modelo devolveu em pedaços', async () => {
    await http.post('/exemplo/stream').send({}).expect(201)

    const [entry] = entries()

    expect(entry!.outbound[0]!.response.body).toEqual({ gherkin: 'oi' })
})

/** A pergunta que originou tudo isto: o que esta requisição disparou para fora, e quanto demorou. */
it('registra a chamada externa disparada dentro da requisição', async () => {
    await http.post('/exemplo/chama').send({ prompt: 'escreva o gherkin' }).expect(201)

    const [entry] = entries()

    expect(entry!.outbound).toHaveLength(1)

    const call = entry!.outbound[0]!

    expect(call.method).toBe('POST')
    expect(call.url).toBe(`${remoteUrl}/modelo`)
    expect(call.status).toBe(200)
    expect(call.durationMs).toBeGreaterThanOrEqual(0)
    expect(call.startedAtMs).toBeGreaterThanOrEqual(0)
    expect(call.request.body).toEqual({ prompt: 'escreva o gherkin' })
    expect(call.response.body).toEqual({ resposta: 'ok' })
})

it('nunca escreve credencial, nem em cabeçalho nem em campo de corpo', async () => {
    await http
        .post('/exemplo/quieto')
        .set('authorization', 'Bearer sk-do-usuario')
        .send({ key: 'sk-secreta', password: 'senha-do-teste', nome: 'visível' })
        .expect(201)

    const written = readFileSync(join(logDir(), readdirSync(logDir())[0]!), 'utf8')

    expect(written).not.toContain('sk-do-usuario')
    expect(written).not.toContain('sk-secreta')
    expect(written).not.toContain('senha-do-teste')
    expect(written).toContain('visível')
    expect(written).toContain('[redigido]')
})

it('redige também a credencial que sai na chamada externa', async () => {
    await http.post('/exemplo/chama').send({ prompt: 'oi' }).expect(201)

    const written = readFileSync(join(logDir(), readdirSync(logDir())[0]!), 'utf8')

    expect(written).not.toContain('sk-secreta')
    expect(written).toContain('[redigido]')
})

/** Um prompt de IA tem dezenas de milhares de caracteres; inteiro, ele afoga o arquivo. */
it('trunca payload grande em vez de despejá-lo inteiro', async () => {
    await http.post('/exemplo/quieto').send({ texto: 'a'.repeat(50_000) }).expect(201)

    const [entry] = entries()

    expect(JSON.stringify(entry!.request.body).length).toBeLessThan(10_000)
    expect(JSON.stringify(entry!.request.body)).toContain('truncado')
})

it('registra o erro da requisição que falhou, com o status que o cliente recebeu', async () => {
    await http.get('/exemplo/quebra').expect(404)

    const [entry] = entries()

    expect(entry!.status).toBe(404)
    expect(entry!.error).toContain('Não encontrado')
})

it('apaga o diário com mais de uma semana e mantém o de dentro da janela', async () => {
    const antigo = join(logDir(), 'requests-2020-01-01.jsonl')
    const recente = join(logDir(), 'requests-2020-01-02.jsonl')

    writeFileSync(antigo, '{}\n')
    writeFileSync(recente, '{}\n')

    const oitoDias = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    utimesSync(antigo, oitoDias, oitoDias)

    await http.post('/exemplo/quieto').send({ nome: 'acutis' }).expect(201)

    expect(existsSync(antigo)).toBe(false)
    expect(existsSync(recente)).toBe(true)
})
