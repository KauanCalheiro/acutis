<script setup lang="ts">
// ponytail: rota de preview (ver .claude/memory/feedback_dev-preview-routes.md) —
// a modal é puramente apresentacional (running/steps via prop), cada botão só
// define a prop direto, sem chamada de API nem stream de verdade.
const startingOpen = ref(false)
const runningOpen = ref(false)
const passedOpen = ref(false)
const failedOpen = ref(false)

const runningSteps = [
  { title: 'Abrir página de login', status: 'success' as const },
  { title: 'Entrar com usuário/código', status: 'success' as const },
  { title: 'Usuário ou código', status: 'pending' as const }
]

const failedSteps = [
  { title: 'Abrir página de login', status: 'success' as const },
  { title: 'Entrar com usuário/código', status: 'success' as const },
  { title: 'Usuário ou código', status: 'failed' as const, error: 'Timed out 5000ms waiting for locator(\'#user-input\')' }
]

const passedSteps = failedSteps.map(step => ({ ...step, status: 'success' as const, error: null }))

const SAMPLE_VIDEO_URL = '/dev/sample-run.webm'
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-bold mb-1">
      Preview: Executando teste
    </h1>
    <p class="text-sm text-muted mb-8">
      Mesmo componente da tela de detalhe do cenário, com dado mocado — um botão por estado.
    </p>

    <div class="flex flex-wrap gap-3">
      <UButton
        label="Iniciando"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-iniciando"
        @click="startingOpen = true"
      />
      <UButton
        label="Rodando"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-rodando"
        @click="runningOpen = true"
      />
      <UButton
        label="Passou"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-passou"
        @click="passedOpen = true"
      />
      <UButton
        label="Falhou"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        data-testid="preview-execucao-falhou"
        @click="failedOpen = true"
      />
    </div>

    <ScenarioTestRunModal
      v-model:open="startingOpen"
      running
      project-name="Nome bem legal do projeto"
      scenario-name="Nome bem legal do cenário"
    />
    <ScenarioTestRunModal
      v-model:open="runningOpen"
      running
      :steps="runningSteps"
      project-name="Nome bem legal do projeto"
      scenario-name="Nome bem legal do cenário"
    />
    <ScenarioTestRunModal
      v-model:open="passedOpen"
      :steps="passedSteps"
      :video-url="SAMPLE_VIDEO_URL"
      project-name="Nome bem legal do projeto"
      scenario-name="Nome bem legal do cenário"
      branch="main"
      tested-at="16/04/2026 14:32"
    />
    <ScenarioTestRunModal
      v-model:open="failedOpen"
      :steps="failedSteps"
      :video-url="SAMPLE_VIDEO_URL"
      project-name="Nome bem legal do projeto"
      scenario-name="Nome bem legal do cenário"
      branch="main"
      tested-at="16/04/2026 14:32"
    />
  </UContainer>
</template>
