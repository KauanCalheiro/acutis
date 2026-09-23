// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readAppConfig } from '../env.js'

describe('configuração da aplicação', () => {
  it('converte e valida os valores do ambiente', () => {
    const config = readAppConfig({
      PORT: '4100',
      CORS_ORIGIN: 'https://acutis.dev',
      RECORDER_HEADLESS: '1',
      LOG_LEVEL: 'error,warn'
    })

    expect(config).toMatchObject({
      port: 4100,
      corsOrigin: 'https://acutis.dev',
      recorderHeadless: true,
      logLevels: [
        'error',
        'warn'
      ]
    })
  })

  it('liga a telemetria quando o CLI repassa o consentimento', () => {
    expect(readAppConfig({ ACUTIS_TELEMETRY: '1' }).telemetry.consent).toBe(true)
  })

  it('deixa a telemetria desligada sem consentimento repassado', () => {
    expect(readAppConfig({}).telemetry.consent).toBe(false)
  })

  it('recusa valor de consentimento que não é 0 nem 1', () => {
    expect(() => readAppConfig({ ACUTIS_TELEMETRY: 'sim' })).toThrow('Configuração inválida')
  })

  it('recusa porta inválida no boot', () => {
    expect(() => readAppConfig({ PORT: 'porta' })).toThrow('Configuração inválida')
  })
})
