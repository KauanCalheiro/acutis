// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { release, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installId } from '../install-id.js'
import { TelemetryService } from '../telemetry.service.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-telemetry-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function service(send: typeof fetch, url = 'https://telemetry.test/reports', consent = true) {
  return new TelemetryService({ url, key: 'chave', root, home: '/Users/kauan', consent }, send)
}

describe('installId', () => {
  it('gera um identificador e o guarda para a próxima execução', () => {
    const first = installId(root)

    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(installId(root)).toBe(first)
  })

  it('gera um novo quando o arquivo está vazio', () => {
    installId(root)
    writeFileSync(join(root, 'runtime/install-id'), '  ')

    expect(installId(root)).toMatch(/^[0-9a-f-]{36}$/)
    expect(readFileSync(join(root, 'runtime/install-id'), 'utf8').trim()).not.toBe('')
  })
})

describe('TelemetryService', () => {
  it('envia o relato com a chave no authorization', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'boom', context: 'runner' })

    const [url, init] = send.mock.calls[0]!
    expect(url).toBe('https://telemetry.test/reports')
    expect(init.headers.authorization).toBe('Bearer chave')
    expect(JSON.parse(init.body)).toMatchObject({ message: 'boom', context: 'runner' })
  })

  it('redige o caminho da home antes de sair da máquina', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'falhou em /Users/kauan/app', stack: 'token=abc12345' })

    const body = JSON.parse(send.mock.calls[0]![1].body)
    expect(body.message).toBe('falhou em ~/app')
    expect(body.stack).toBe('token=[redigido]')
  })

  it('acrescenta versão, plataforma e identificador da instalação', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'boom' })

    const body = JSON.parse(send.mock.calls[0]![1].body)
    expect(body.platform).toBe(`${process.platform} ${process.arch} ${release()}`)
    expect(body.nodeVersion).toBe(process.version)
    expect(body.installId).toBe(installId(root))
    expect(typeof body.cliVersion).toBe('string')
  })

  it('engole a falha de rede em vez de estourar na tela', async () => {
    const send = vi.fn().mockRejectedValue(new Error('sem rede'))

    await expect(service(send).report({ message: 'boom' })).resolves.toBe(false)
  })

  it('não envia nada quando não há url configurada', async () => {
    const send = vi.fn()

    await expect(service(send, '').report({ message: 'boom' })).resolves.toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('confirma o envio quando o servidor aceita', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await expect(service(send).report({ message: 'boom' })).resolves.toBe(true)
  })

  it('trata resposta de recusa como envio não feito', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 429 }))

    await expect(service(send).report({ message: 'boom' })).resolves.toBe(false)
  })

  it('não envia nada sem o consentimento da pessoa', async () => {
    const send = vi.fn()

    await expect(service(send, undefined, false).report({ message: 'boom' })).resolves.toBe(false)
    expect(send).not.toHaveBeenCalled()
  })

  it('envia uma vez só o mesmo erro repetido', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    const telemetry = service(send)

    await telemetry.report({ message: 'boom', stack: 'at x', context: 'runner' })
    await expect(telemetry.report({ message: 'boom', stack: 'at x', context: 'runner' })).resolves.toBe(false)

    expect(send).toHaveBeenCalledOnce()
  })

  it('envia erros diferentes em sequência', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    const telemetry = service(send)

    await telemetry.report({ message: 'boom' })
    await telemetry.report({ message: 'outro boom' })

    expect(send).toHaveBeenCalledTimes(2)
  })

  it('leva os detalhes do erro junto do contexto, legíveis', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'boom', context: 'recorder:start', details: { mode: 'auth', replaySteps: 3 } })

    const { context } = JSON.parse(send.mock.calls[0]![1].body)
    expect(context.split('\n')[0]).toBe('recorder:start')
    expect(JSON.parse(context.slice(context.indexOf('\n') + 1))).toEqual({ mode: 'auth', replaySteps: 3 })
  })

  it('mantém o contexto simples quando não há detalhes', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'boom', context: 'Gerar cenário' })

    expect(JSON.parse(send.mock.calls[0]![1].body).context).toBe('Gerar cenário')
  })

  it('redige os detalhes antes de sair da máquina', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'boom', context: 'runner', details: { spec: '/Users/kauan/loja/tests/a.spec.ts' } })

    expect(JSON.parse(send.mock.calls[0]![1].body).context).toContain('~/loja/tests/a.spec.ts')
  })

  it('mascara os segredos do projeto em toda parte do relato', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({
      message: 'login falhou com senha-do-cliente',
      stack: 'fill("senha-do-cliente")',
      context: 'runner',
      details: { output: 'digitou senha-do-cliente' },
      secrets: ['senha-do-cliente']
    })

    const body = send.mock.calls[0]![1].body
    expect(body).not.toContain('senha-do-cliente')
    expect(JSON.parse(body).message).toBe('login falhou com [redigido]')
  })

  it('mascara segredo do projeto mesmo curto', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'senha abc123 recusada', secrets: ['abc123'] })

    expect(JSON.parse(send.mock.calls[0]![1].body).message).toBe('senha [redigido] recusada')
  })

  it('não mascara valor de projeto curto demais para ser segredo', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'passo 1 de 2', secrets: ['1'] })

    expect(JSON.parse(send.mock.calls[0]![1].body).message).toBe('passo 1 de 2')
  })

  it('não manda a lista de segredos para o servidor', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))

    await service(send).report({ message: 'boom', secrets: ['segredo-longo'] })

    expect(JSON.parse(send.mock.calls[0]![1].body)).not.toHaveProperty('secrets')
  })

  it('tenta de novo o erro cujo envio falhou', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('sem rede'))
      .mockResolvedValue(new Response(null, { status: 202 }))
    const telemetry = service(send)

    await telemetry.report({ message: 'boom' })

    await expect(telemetry.report({ message: 'boom' })).resolves.toBe(true)
  })
})
