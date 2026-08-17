import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import swc from 'unplugin-swc'
import { resolve } from 'path'

export default defineConfig({
    // O swc entra por causa do Nest: a injeção por construtor lê o tipo do parâmetro em
    // `emitDecoratorMetadata`, e o esbuild que o vitest usa por padrão não emite essa metadata —
    // o controller recebia `undefined` no lugar do service.
    plugins: [vue(), swc.vite({ module: { type: 'es6' } })],
    resolve: {
        alias: { '@': resolve(__dirname, 'src') },
    },
    test: {
        // A pill roda em jsdom; os testes de servidor declaram `// @vitest-environment node` no topo.
        environment: 'jsdom',
        setupFiles: ['./test/setup/pill.ts'],
        include: [
            'src/**/__tests__/**/*.spec.ts',
            'test/**/*.spec.ts',
            'reporters/**/*.spec.ts',
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'lcov'],
            include: ['src/**/*.ts', 'reporters/*.cjs'],
            exclude: [
                'src/**/__tests__/**',
                'src/migrations/**',
                'src/**/*.vue',
                // Bootstrap e script de linha de comando: fiação, não comportamento.
                'src/main.ts',
                'src/app.module.ts',
                'src/scripts/**',
                // Arquivos só de tipo, sem comportamento a cobrir.
                'src/common/types/**',
                'src/**/responses/**',
                'src/webdriver/pill/driverEntry.ts',
                // Playwright de verdade controlando o navegador e socket real: a cobertura destes
                // mora no E2E (`e2e/`), que sobe o webdriver como processo — ver a memória
                // webdriver-tdd. Mockar Playwright aqui daria cobertura sem garantia nenhuma.
                'src/webdriver/recorder/**',
                'src/webdriver/gateway/**',
                'src/webdriver/runner/runner.service.ts',
            ],
            // Piso um pouco abaixo do medido hoje (99/91/99/99), para o gate acusar regressão sem
            // quebrar por um `catch` defensivo a mais.
            thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
        },
    },
})
