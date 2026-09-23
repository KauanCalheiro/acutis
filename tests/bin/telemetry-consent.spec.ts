// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveTelemetryConsent } from '../../bin/telemetry-consent.js'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-consent-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const consentFile = () => join(root, 'runtime/telemetry-consent')

function saved(answer: string) {
  mkdirSync(join(root, 'runtime'), { recursive: true })
  writeFileSync(consentFile(), answer)
}

function resolve(options: { ask?: (question: string) => Promise<string>, interactive?: boolean, env?: Record<string, string> } = {}) {
  return resolveTelemetryConsent({
    root,
    env: options.env ?? {},
    interactive: options.interactive ?? true,
    ask: options.ask ?? vi.fn().mockResolvedValue('s')
  })
}

describe('resolveTelemetryConsent', () => {
  it('pergunta na primeira execução explicando o que é coletado', async () => {
    const ask = vi.fn().mockResolvedValue('s')

    await resolve({ ask })

    expect(ask).toHaveBeenCalledOnce()
    expect(ask.mock.lastCall![0]).toContain('relatos de erro')
  })

  it('aceita quando a pessoa responde sim', async () => {
    await expect(resolve({ ask: vi.fn().mockResolvedValue('s') })).resolves.toBe(true)
  })

  it('aceita a palavra sim inteira, sem diferenciar maiúscula', async () => {
    await expect(resolve({ ask: vi.fn().mockResolvedValue(' Sim ') })).resolves.toBe(true)
  })

  it('recusa quando a pessoa responde não', async () => {
    await expect(resolve({ ask: vi.fn().mockResolvedValue('n') })).resolves.toBe(false)
  })

  it('recusa quando a pessoa só aperta enter', async () => {
    await expect(resolve({ ask: vi.fn().mockResolvedValue('') })).resolves.toBe(false)
  })

  it('guarda o sim para a próxima execução', async () => {
    await resolve({ ask: vi.fn().mockResolvedValue('s') })

    expect(readFileSync(consentFile(), 'utf8')).toBe('sim')
  })

  it('guarda o não para a próxima execução', async () => {
    await resolve({ ask: vi.fn().mockResolvedValue('n') })

    expect(readFileSync(consentFile(), 'utf8')).toBe('nao')
  })

  it('não pergunta de novo quando o sim já está guardado', async () => {
    saved('sim')
    const ask = vi.fn()

    await expect(resolve({ ask })).resolves.toBe(true)
    expect(ask).not.toHaveBeenCalled()
  })

  it('não pergunta de novo quando o não já está guardado', async () => {
    saved('nao')
    const ask = vi.fn()

    await expect(resolve({ ask })).resolves.toBe(false)
    expect(ask).not.toHaveBeenCalled()
  })

  it('pergunta de novo quando o arquivo guardado não tem resposta válida', async () => {
    saved('talvez')
    const ask = vi.fn().mockResolvedValue('s')

    await expect(resolve({ ask })).resolves.toBe(true)
    expect(ask).toHaveBeenCalledOnce()
  })

  it('recusa sem perguntar nem guardar quando não há terminal interativo', async () => {
    const ask = vi.fn()

    await expect(resolve({ ask, interactive: false })).resolves.toBe(false)
    expect(ask).not.toHaveBeenCalled()
    expect(existsSync(consentFile())).toBe(false)
  })

  it('respeita DO_NOT_TRACK sem perguntar nem guardar', async () => {
    const ask = vi.fn()

    await expect(resolve({ ask, env: { DO_NOT_TRACK: '1' } })).resolves.toBe(false)
    expect(ask).not.toHaveBeenCalled()
    expect(existsSync(consentFile())).toBe(false)
  })

  it('DO_NOT_TRACK vence um sim guardado', async () => {
    saved('sim')

    await expect(resolve({ env: { DO_NOT_TRACK: '1' } })).resolves.toBe(false)
  })
})
