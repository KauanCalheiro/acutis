import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  alias: {
    '@acutis/core': fileURLToPath(new URL('./core', import.meta.url))
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    serverAssets: [
      {
        baseName: 'recorder',
        dir: fileURLToPath(new URL('./dist-ui', import.meta.url))
      },
      {
        baseName: 'templates',
        dir: fileURLToPath(new URL('./stubs', import.meta.url))
      }
    ],
    experimental: {
      websocket: true
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    // Varre o código e embarca os ícones usados: o SSR não busca nada na rede.
    clientBundle: {
      scan: true
    }
  }
})
