/**
 * O diário de requisições: uma linha JSON por requisição atendida, com o que entrou, o que saiu e
 * toda chamada HTTP que ela disparou para fora.
 *
 * Existe porque a pergunta que o acutis faz quando algo demora ou falha é sempre a mesma — "o que
 * mandamos para o provedor, o que ele devolveu e quanto tempo levou" — e responder isso lendo o
 * código não dá: a chamada nasce dentro do LangChain, três camadas abaixo de quem a pediu.
 *
 * Tudo mora aqui de propósito: o domínio não ganha uma linha de log. Quem captura a entrada é um
 * middleware, quem captura a saída é o `fetch` global embrulhado uma vez, e quem amarra os dois é o
 * `AsyncLocalStorage` — sem ele, uma chamada ao modelo seria um evento solto, sem dono.
 */
import type { CallHandler, ExecutionContext, INestApplication, NestInterceptor } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
// Renomeados: `Request` e `Response` do express colidem com os globais que o `fetch` usa, e são
// esses globais que a captura de saída manipula.
import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express'
import type { Observable } from 'rxjs'
import { catchError, tap } from 'rxjs/operators'
import { acutis } from './acutis.js'

export interface Payload {
    headers?: Record<string, string>
    body?: unknown
}

export interface OutboundCall {
    method: string
    url: string
    status: number | null
    durationMs: number
    /** Desde o início da requisição. É o que mostra o tempo entre uma chamada e a seguinte. */
    startedAtMs: number
    request: Payload
    response: Payload
    error?: string
}

export interface RequestEntry {
    /** Como se fala desta requisição depois: no jq, no relatório de erro, na conversa. */
    id: string
    at: string
    method: string
    url: string
    status: number
    durationMs: number
    request: Payload
    response: Payload
    outbound: OutboundCall[]
    error: string | null
}

/** O que uma requisição acumula enquanto é atendida. */
interface Store {
    startedAt: number
    outbound: OutboundCall[]
    responseBody?: unknown
    error?: string
}

const store = new AsyncLocalStorage<Store>()

/** Uma semana: é o que serve para investigar, e mais do que isso só ocupa disco. */
const RETENTION_DAYS = 7

/** O teto de cada payload. Um prompt de IA passa de 50 mil caracteres e afogaria o arquivo. */
const MAX_PAYLOAD = 4_000

/**
 * O que nunca pode ser escrito.
 *
 * O arquivo fica em disco e acaba anexado a relatório de erro; a chave do provedor viaja em todo
 * pedido ao modelo. Casa por nome de campo, e não por valor, porque o valor muda a cada instalação.
 */
const SECRET = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api[-_]?key|key|token|secret|password|senha|pass)$/i

const REDACTED = '[redigido]'

function isSecret(name: string): boolean {
    return SECRET.test(name.trim())
}

/** Redige em profundidade: o segredo tanto vem no topo do corpo quanto aninhado no que a IA manda. */
function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact)

    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([name, item]) => [name, isSecret(name) ? REDACTED : redact(item)])
        )
    }

    return value
}

/** Redigido e dentro do teto. Acima dele vira texto cortado, que ainda diz o que estava indo. */
function capture(value: unknown): unknown {
    if (value === undefined || value === null || value === '') return undefined

    const clean = redact(value)
    const text = JSON.stringify(clean)

    if (text === undefined) return undefined

    return text.length <= MAX_PAYLOAD
        ? clean
        : `[truncado, ${text.length} caracteres] ${text.slice(0, MAX_PAYLOAD)}`
}

function captureHeaders(headers: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [
            name.toLowerCase(),
            isSecret(name) ? REDACTED : String(value)
        ])
    )
}

/** O corpo chega string do cliente e do provedor; guardá-lo como objeto é o que deixa filtrar no jq. */
function parsed(text: string): unknown {
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

/** O pedaço de texto que cada formato de streaming carrega. */
function delta(chunk: unknown): string | null {
    const piece = chunk as {
        message?: { content?: unknown }
        choices?: { delta?: { content?: unknown } }[]
        response?: unknown
    }

    const value = piece?.message?.content ?? piece?.choices?.[0]?.delta?.content ?? piece?.response

    return typeof value === 'string' ? value : null
}

/**
 * A resposta que veio em pedaços, remontada no texto que ela formava.
 *
 * O modelo devolve um JSON por linha, com um punhado de caracteres em cada — NDJSON no Ollama,
 * `data:` do SSE nos compatíveis com a OpenAI. Guardado cru, o corpo vira milhares de fragmentos
 * que estouram o teto e escondem justamente a resposta que se queria ler.
 *
 * Devolve null quando o corpo não é isso, e aí ele é guardado como veio.
 */
function joinStreamed(text: string): string | null {
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line !== '')

    if (lines.length < 2) return null

    const parts: string[] = []

    for (const line of lines) {
        const payload = line.startsWith('data:') ? line.slice(5).trim() : line

        if (payload === '[DONE]') continue

        let chunk: unknown

        try {
            chunk = JSON.parse(payload)
        } catch {
            return null
        }

        const piece = delta(chunk)

        if (piece === null) return null

        parts.push(piece)
    }

    return parts.length === 0 ? null : parts.join('')
}

export function logDir(): string {
    const dir = join(acutis().root, 'runtime/logs')

    mkdirSync(dir, { recursive: true })

    return dir
}

function fileFor(date: Date): string {
    return `requests-${date.toISOString().slice(0, 10)}.jsonl`
}

/**
 * Um arquivo por dia, e some quem passou da semana.
 *
 * A limpeza roda quando o arquivo do dia muda — na subida e na virada da meia-noite — em vez de a
 * cada requisição: varrer o diretório para escrever uma linha seria pagar por nada.
 */
let purgedFor = ''

function purge(dir: string, current: string): void {
    // A chave inclui o diretório: a raiz do acutis é configurável, e guardá-la fora da chave faria
    // uma raiz nova herdar a limpeza da anterior e nunca varrer a sua.
    const key = join(dir, current)

    if (purgedFor === key) return

    purgedFor = key

    const limit = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

    for (const file of readdirSync(dir)) {
        if (!file.startsWith('requests-') || !file.endsWith('.jsonl')) continue

        const path = join(dir, file)

        if (statSync(path).mtimeMs < limit) rmSync(path, { force: true })
    }
}

function write(entry: RequestEntry): void {
    try {
        const dir = logDir()
        const file = fileFor(new Date())

        purge(dir, file)

        appendFileSync(join(dir, file), `${JSON.stringify(entry)}\n`)
    } catch {
        // Diário quebrado não derruba requisição: ele existe para explicar o problema, não para ser um.
    }
}

let installed = false

/**
 * Embrulha o `fetch` global uma vez.
 *
 * É por ele que passa tudo que o acutis manda para fora — o provedor de IA inclusive, já que o
 * LangChain usa `fetch` por baixo. Fora de uma requisição não há o que anotar, e a chamada segue
 * direto: é o caso das buscas que a subida do processo faz.
 */
function installFetchCapture(): void {
    if (installed) return

    installed = true

    const original = globalThis.fetch

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const current = store.getStore()

        if (!current) return original(input, init)

        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
        const startedAt = Date.now()

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))

        const call: OutboundCall = {
            method,
            url,
            status: null,
            durationMs: 0,
            startedAtMs: startedAt - current.startedAt,
            request: {
                headers: captureHeaders(Object.fromEntries(headers.entries())),
                body: typeof init?.body === 'string' ? capture(parsed(init.body)) : undefined
            },
            response: {}
        }

        current.outbound.push(call)

        try {
            const response = await original(input, init)

            call.status = response.status
            call.durationMs = Date.now() - startedAt
            call.response.headers = captureHeaders(Object.fromEntries(response.headers.entries()))

            // O clone é o que permite ler sem consumir o corpo de quem pediu.
            const text = await response.clone().text()
            const joined = joinStreamed(text)

            // O texto remontado é reinterpretado: o que o modelo escreve em pedaços é um JSON, e
            // guardá-lo como objeto é o que deixa filtrar campo a campo depois.
            call.response.body = capture(joined === null ? parsed(text) : parsed(joined))

            return response
        } catch (error) {
            call.durationMs = Date.now() - startedAt
            call.error = error instanceof Error ? error.message : String(error)

            throw error
        }
    }
}

/**
 * O interceptor só recolhe o que é do Nest: o corpo que o controller devolveu e o erro que ele
 * lançou. A escrita não é dele porque o status final só existe depois do filtro de erro.
 */
@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const current = store.getStore()

        return next.handle().pipe(
            tap((body) => {
                if (current) current.responseBody = body
            }),
            catchError((error: unknown) => {
                if (current) current.error = error instanceof Error ? error.message : String(error)

                throw error
            })
        )
    }
}

/**
 * Liga o diário no app.
 *
 * O contexto nasce em middleware, e não no interceptor, porque o interceptor devolve um observable
 * que só executa o handler quando alguém assina — fora do escopo do `AsyncLocalStorage`. O
 * middleware embrulha a requisição inteira, que é o que faz um `fetch` no fundo da pilha saber a
 * quem pertence.
 */
export function installRequestLog(app: INestApplication): void {
    installFetchCapture()

    app.use((request: ExpressRequest, response: ExpressResponse, next: NextFunction) => {
        const current: Store = { startedAt: Date.now(), outbound: [] }

        response.on('finish', () => write({
            id: randomUUID(),
            at: new Date(current.startedAt).toISOString(),
            method: request.method,
            url: request.originalUrl,
            status: response.statusCode,
            durationMs: Date.now() - current.startedAt,
            request: {
                headers: captureHeaders(request.headers as Record<string, unknown>),
                body: capture(request.body)
            },
            response: { body: capture(current.responseBody) },
            outbound: current.outbound,
            error: current.error ?? null
        }))

        store.run(current, next)
    })

    app.useGlobalInterceptors(new RequestLogInterceptor())
}
