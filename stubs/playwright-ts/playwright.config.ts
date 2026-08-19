import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

// Autenticação é opcional: sem tests/auth.setup.ts o project "setup" não casa com nada,
// storageState fica indefinido e os cenários rodam normalmente, sem sessão.
const autenticado = existsSync('tests/auth.setup.ts')

const storageState = process.env.STORAGE_STATE || 'storage-state.json'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  outputDir: './results/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: './results/report', open: 'never' }]
  ],
  use: {
    baseURL: process.env.URL || 'http://localhost:3000',
    headless: true,
    video: { mode: 'on', show: { actions: { duration: 500, fontSize: 1 }, test: { level: 'step' } } },
    launchOptions: { slowMo: 500 },
    screenshot: 'only-on-failure',
    trace: 'on'
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      // Cenários marcados @publico rodam sem sessão, e é o que permite testar a própria
      // tela de login, cadastro ou uma landing num projeto que tem autenticação.
      name: 'publicos',
      testMatch: /.*\.spec\.ts/,
      grep: /@publico/
    },
    {
      name: 'autenticados',
      testMatch: /.*\.spec\.ts/,
      grepInvert: /@publico/,
      dependencies: autenticado ? ['setup'] : [],
      use: autenticado ? { storageState } : {}
    }
  ]
})
