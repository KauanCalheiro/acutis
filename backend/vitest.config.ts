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
            exclude: ['src/**/__tests__/**', 'src/migrations/**', 'src/**/*.vue', 'src/main.ts'],
            thresholds: { lines: 75, functions: 82, branches: 80, statements: 75 },
        },
    },
})
