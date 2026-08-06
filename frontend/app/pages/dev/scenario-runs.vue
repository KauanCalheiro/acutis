<script setup lang="ts">
import type { ScenarioRun } from '~/types/project'

// ponytail: rota de preview, o histórico é apresentacional (runs via prop), então basta o dado
// mocado; busca, status e paginação são estado interno do componente.
function run(
  startedAt: string,
  durationMs: number,
  branch: string,
  author: string,
  failedStep?: string
): ScenarioRun {
  return {
    started_at: startedAt,
    duration_ms: durationMs,
    passed: !failedStep,
    branch,
    author,
    steps: [
      {
        title: 'Abrir página de login',
        status: 'success',
        duration_ms: 900,
        error: null
      },
      ...(failedStep
        ? [{
            title: failedStep,
            status: 'failed' as const,
            duration_ms: 2600,
            error: 'expected 1 to equal 2'
          }]
        : [])
    ],
    playwright: 'import { test } from "@playwright/test"',
    video_path: null
  }
}

const runs = [
  run('2026-06-13T09:15:02+00:00', 3800, 'main', 'Testadora'),
  run('2026-06-12T14:08:31+00:00', 4200, 'main', 'Testadora', 'Entrar com usuário/código'),
  run('2026-06-11T17:02:00+00:00', 3400, 'main', 'Testadora'),
  run('2026-06-11T15:45:00+00:00', 4100, 'feat/checkout', 'Revisora'),
  run('2026-06-11T13:20:00+00:00', 2900, 'main', 'Testadora'),
  run('2026-06-11T10:15:00+00:00', 9800, 'main', 'Testadora', 'Ver o painel'),
  run('2026-06-11T08:40:00+00:00', 3100, 'main', 'Testadora'),
  run('2026-06-10T11:05:00+00:00', 4600, 'feat/checkout', 'Revisora'),
  run('2026-06-10T09:30:00+00:00', 7300, 'feat/checkout', 'Revisora', 'Confirmar o pedido'),
  run('2026-06-10T08:12:00+00:00', 5100, 'main', 'Testadora')
]
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-bold mb-1">
      Preview: histórico de execuções
    </h1>
    <p class="text-sm text-muted mb-8">
      Mesmo componente da seção Testes da tela de cenário, com dez execuções mocadas. Busque por
      <code>feat/checkout</code>, por <code>Revisora</code> ou por <code>Confirmar o pedido</code>.
    </p>

    <ScenarioTestRunHistory :runs="runs" />

    <div class="mt-16">
      <h2 class="text-sm font-semibold mb-2">
        Sem execução nenhuma
      </h2>
      <ScenarioTestRunHistory />
    </div>
  </UContainer>
</template>
