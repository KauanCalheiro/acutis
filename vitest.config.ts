import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    // Cada arquivo sobe um app Nuxt inteiro: sem teto de workers, numa máquina já ocupada o
    // `setupNuxt` estoura o hook antes de terminar.
    maxWorkers: 4,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    include: [
      'app/**/*.spec.ts',
      'core/**/*.spec.ts',
      'reporters/**/*.spec.ts',
      'tests/**/*.spec.ts'
    ],
    setupFiles: ['./test/setup/pill.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['app/**/*.{ts,vue}'],
      exclude: ['app/**/*.d.ts'],
      // Piso um pouco abaixo do medido hoje (99/93/99/99), para o gate acusar regressão sem
      // quebrar por uma linha a mais de template.
      thresholds: { lines: 95, functions: 95, branches: 92, statements: 95 }
    }
  }
})
