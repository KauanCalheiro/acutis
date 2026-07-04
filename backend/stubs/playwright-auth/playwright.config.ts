import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests',
    timeout: 60_000,
    outputDir: './results/artifacts',
    reporter: [
        ['list'],
        ['html', { outputFolder: './results/report', open: 'never' }],
    ],
    use: {
        baseURL: '{{baseUrl}}',
        video: 'on',
        screenshot: 'only-on-failure',
        trace: 'on',
    },
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.ts/ },
        {
            name: 'autenticado',
            testMatch: /.*\.spec\.ts/,
            dependencies: ['setup'],
            use: { storageState: 'storage-state.json' },
        },
    ],
})
