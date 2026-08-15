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

  runtimeConfig: {
    api: {
      acutis: {
        // O mesmo endereço do gravador: a API e ele vivem no mesmo processo.
        url: 'http://localhost:4000'
      }
    },
    public: {
      webdriver: {
        acutis: {
          url: 'http://localhost:4000'
        }
      }
    }
  },

  compatibilityDate: '2026-06-30',

  nitro: {
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
  }
})
