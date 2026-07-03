import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
    plugins: [vue()],
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
        include: ['src/ui/**/*.spec.ts'],
    },
})
