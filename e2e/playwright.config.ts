import { defineConfig } from '@playwright/test'
import { BACKEND_URL, FRONTEND_URL, PORTS, WEBDRIVER_URL } from './support/ports'

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
            NUXT_API_ACUTIS_URL: BACKEND_URL,
            NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL: WEBDRIVER_URL,
        },
    },
})
