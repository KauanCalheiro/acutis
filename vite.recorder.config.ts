import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'core') }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  build: {
    outDir: 'dist-ui',
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'core/webdriver/pill/driverEntry.ts'),
      name: 'AcutisDriverEntry',
      formats: ['iife'],
      fileName: () => 'driver-entry.js'
    }
  }
})
