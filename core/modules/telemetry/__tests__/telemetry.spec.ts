// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

function service(send: typeof fetch, url = 'https://telemetry.test/reports') {
  return new TelemetryService({ url, key: 'chave', root, home: '/Users/kauan' }, send)
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
    expect(body.platform).toBe(process.platform)
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
})
