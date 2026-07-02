import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import manifestJson from './manifest.json'
import type { ManifestV3Export } from '@crxjs/vite-plugin'

export default defineConfig({
  plugins: [
    vue(),
    crx({ manifest: manifestJson as ManifestV3Export }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
  define: {
    __APP_VERSION__: JSON.stringify('2.0.0'),
  },
})
