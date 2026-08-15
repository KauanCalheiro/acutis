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
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
        outDir: 'dist-ui',
        emptyOutDir: true,
        lib: {
            entry: resolve(__dirname, 'src/ui/driverEntry.ts'),
            name: 'AcutisDriverEntry',
            formats: ['iife'],
            fileName: () => 'driver-entry.js',
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/ui/test-setup.ts'],
        // A API migrada do Laravel vive em src/api. Cada arquivo lá declara
        // `// @vitest-environment node` no topo: são testes de servidor, não de componente.
        include: [
            'src/ui/**/*.spec.ts',
            'reporters/**/*.spec.ts',
            'src/runner/**/*.spec.ts',
            'src/api/**/*.spec.ts',
        ],
    },
})
