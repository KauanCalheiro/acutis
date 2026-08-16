import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['app/**/*.{ts,vue}'],
      exclude: ['app/**/*.d.ts'],
      thresholds: { lines: 18, functions: 18, branches: 18, statements: 18 }
    }
  }
})
