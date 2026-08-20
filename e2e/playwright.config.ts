import { defineConfig } from '@playwright/test'
import { FRONTEND_URL } from './support/ports'

/** Os testes que só funcionam com um modelo de verdade atrás do backend. */
const AI_DEPENDENT = /@ia/

export default defineConfig({
    testDir: './tests',
    ...(process.env.OLLAMA_URL ? {} : { grepInvert: AI_DEPENDENT }),
    timeout: 30_000,
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: FRONTEND_URL,
        video: 'on',
    },
})
