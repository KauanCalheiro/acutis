import { defineConfig } from '@playwright/test'
import { FRONTEND_URL, PORTS, WEBDRIVER_URL } from './support/ports'

export default defineConfig({
    testDir: './tests',
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
            // A API mora no mesmo processo do gravador desde a migração para Node.
            NUXT_API_ACUTIS_URL: WEBDRIVER_URL,
            NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL: WEBDRIVER_URL,
        },
    },
})
