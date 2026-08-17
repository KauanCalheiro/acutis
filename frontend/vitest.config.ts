import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    // Cada arquivo sobe um app Nuxt inteiro: sem teto de workers, numa máquina já ocupada o
    // `setupNuxt` estoura o hook antes de terminar.
    maxWorkers: 4,
    hookTimeout: 30_000,
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['app/**/*.{ts,vue}'],
      // As páginas em app/pages/dev são bancada de desenvolvimento (404 em produção) e não têm
      // teste por diretriz do projeto, então não entram na conta.
      exclude: ['app/**/*.d.ts', 'app/pages/dev/**'],
      // Piso um pouco abaixo do medido hoje (99/93/99/99), para o gate acusar regressão sem
      // quebrar por uma linha a mais de template.
      thresholds: { lines: 95, functions: 95, branches: 92, statements: 95 }
    }
  }
})
