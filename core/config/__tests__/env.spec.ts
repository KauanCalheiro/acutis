// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readAppConfig } from '../env.js'

describe('configuração da aplicação', () => {
  it('converte e valida os valores do ambiente', () => {
    const config = readAppConfig({
      PORT: '4100',
      CORS_ORIGIN: 'https://acutis.dev',
      RECORDER_HEADLESS: '1',
      WEBDRIVER_TEST_MODE: '1',
      LOG_LEVEL: 'error,warn'
    })

    expect(config).toMatchObject({
      port: 4100,
      corsOrigin: 'https://acutis.dev',
      recorderHeadless: true,
      webdriverTestMode: true,
      logLevels: [
        'error',
        'warn'
      ]
    })
  })

  it('recusa porta inválida no boot', () => {
    expect(() => readAppConfig({ PORT: 'porta' })).toThrow('Configuração inválida')
  })
})
