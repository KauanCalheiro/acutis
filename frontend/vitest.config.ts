import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['app/**/*.{ts,vue}'],
      exclude: ['app/**/*.d.ts'],
      // Piso simbólico: a cobertura de tela mora no E2E, não aqui. Ajustado de 18 para 16 quando o
      // lockfile unificado trouxe o vite 8 — o v8 passou a instrumentar diferente e o mesmo código
      // passou a medir ~0,6 ponto a menos.
      thresholds: { lines: 16, functions: 16, branches: 16, statements: 16 }
    }
  }
})
