import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests',
    use: {
        baseURL: 'http://localhost:3000',
        headless: true,
        video: { mode: 'on', show: { actions: { duration: 500, fontSize: 1 }, test: { level: 'step' } } },
        launchOptions: { slowMo: 500 },
    },
})
