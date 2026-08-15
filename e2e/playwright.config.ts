import { defineConfig } from '@playwright/test'
import { FRONTEND_URL, PORTS, WEBDRIVER_URL } from './support/ports'

/** Os testes que só funcionam com um modelo de verdade atrás do backend. */
const AI_DEPENDENT = /@ia/

export default defineConfig({
    testDir: './tests',
    ...(process.env.OLLAMA_URL ? {} : { grepInvert: AI_DEPENDENT }),
    timeout: 30_000,
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: FRONTEND_URL,
        video: 'on',
    },
    webServer: {
        command: 'pnpm preview',
        cwd: '../frontend',
        url: FRONTEND_URL,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
            ...process.env,
            PORT: String(PORTS.frontend),
            NUXT_API_ACUTIS_URL: WEBDRIVER_URL,
            NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL: WEBDRIVER_URL,
        },
    },
})
