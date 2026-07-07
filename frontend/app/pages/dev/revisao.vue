<script setup lang="ts">
import type { RecorderEvent } from '~/composables/webdriver'
import type { TestDraft } from '~/types/project'

if (!import.meta.dev) {
  throw createError({ statusCode: 404, statusMessage: 'Página não encontrada' })
}

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

const mockRecordingStartedAt = 1000

const mockEvents: RecorderEvent[] = [
  {
    event: 'recorder:navigate',
    type: 'navigate',
    url: 'http://127.0.0.1:4321/',
    label: 'Acutis Store',
    timestamp: mockRecordingStartedAt + 200
  },
  {
    event: 'recorder:fill',
    type: 'fill',
    url: 'http://127.0.0.1:4321/',
    label: 'Nome completo',
    value: 'Ana Souza',
    selectors: { dataTestId: 'login-name', cssStable: '#name' },
    timestamp: mockRecordingStartedAt + 1400
  },
  {
    event: 'recorder:click',
    type: 'click',
    url: 'http://127.0.0.1:4321/',
    label: 'Entrar',
    selectors: { dataTestId: 'login-submit', cssStable: '#submit' },
    timestamp: mockRecordingStartedAt + 2100
  }
]

const mockDraft = ref<TestDraft>({
  title: 'Fluxo de login',
  tags: ['@read'],
  path: 'fluxo-de-login',
  gherkin: [
    '@read',
    'Funcionalidade: Login',
    '  Cenário: usuário faz login com sucesso',
    '    Dado que estou na página inicial',
    '    Quando preencho o formulário de login',
    '    Então devo ver a página autenticada'
  ].join('\n'),
  playwright: `import { test } from '@playwright/test'

test('faz login', async ({ page }) => {
  await page.goto('/')
})`
})

const tabs = [
  { label: 'Revisão', value: 'review' },
  { label: 'Loading', value: 'loading' },
  { label: 'Edição', value: 'edit' }
]

const step = ref<'review' | 'loading' | 'edit'>('review')

const title = computed(() => {
  if (step.value === 'loading') return 'Gerando cenário'
  if (step.value === 'edit') return 'Revise os contextos'
  return 'Revise seus eventos'
})

const open = ref(true)
</script>

<template>
  <UContainer
    class="py-8"
    :data-hydrated="hydrated"
  >
    <BaseModal
      v-model:open="open"
      :dismissable="false"
      wide
    >
      <template #header>
        <div class="flex flex-col gap-3">
          <h2 class="text-xl font-semibold">
            {{ title }}
          </h2>
          <UTabs
            v-model="step"
            :items="tabs"
            :content="false"
            data-testid="dev-revisao-tabs"
          />
        </div>
      </template>

      <template #body>
        <ScenarioReviewLoading v-if="step === 'loading'" />

        <ScenarioReviewContexts
          v-else-if="step === 'edit'"
          v-model:draft="mockDraft"
        />

        <ScenarioReviewTimeline
          v-else
          :events="mockEvents"
          :recording-started-at="mockRecordingStartedAt"
        />
      </template>
    </BaseModal>
  </UContainer>
</template>
