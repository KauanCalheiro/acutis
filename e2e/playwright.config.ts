import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    fullyParallel: true,
    retries: 0,
    workers: 3,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: 'http://localhost:3000',
        video: 'on',
    },
    webServer: {
        command: 'pnpm dev',
        cwd: '../frontend',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
})
