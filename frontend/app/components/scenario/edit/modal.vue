<script setup lang="ts">
import type { ScenarioDetail, TestDraft } from '~/types/project'

interface ScenarioEditModal {
  slug: string
  scenario: ScenarioDetail
}

const { slug, scenario } = defineProps<ScenarioEditModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  updated: [scenario: ScenarioDetail]
}>()

function draftFromScenario(scenario: ScenarioDetail): TestDraft {
  const id = scenario.spec.replace(/^tests\//, '').replace(/\.spec\.ts$/, '')
  const parts = id.split('/')

  return {
    title: scenario.title,
    path: parts.at(-1)!,
    domain: parts.length > 1 ? parts.slice(0, -1).join('/') : '',
    tags: scenario.tags,
    gherkin: scenario.gherkin ?? '',
    playwright: scenario.playwright
  }
}

const draft = ref<TestDraft>(draftFromScenario(scenario))
const saving = ref(false)
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) {
    draft.value = draftFromScenario(scenario)
    error.value = null
  }
})

const scenarioId = computed(() => scenario.spec.replace(/^tests\//, '').replace(/\.spec\.ts$/, ''))

async function save() {
  saving.value = true
  error.value = null

  try {
    const updated = await $fetch<ScenarioDetail>(`/api/projects/${slug}/scenarios/${scenarioId.value}`, {
      method: 'PATCH',
      body: draft.value
    })
    open.value = false
    emit('updated', updated)
  } catch (err) {
    const e = err as { data?: { data?: { errors?: Record<string, string[]> } } }
    const firstError = Object.values(e.data?.data?.errors ?? {})[0]?.[0]
    error.value = firstError ?? 'Não foi possível salvar o cenário.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Editar cenário"
    wide
  >
    <template #body>
      <ScenarioReviewContexts v-model:draft="draft" />

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :description="error"
        class="mt-4"
      />
    </template>

    <template #footer>
      <UButton
        label="Cancelar"
        color="neutral"
        variant="ghost"
        data-testid="cenario-editar-cancelar"
        @click="open = false"
      />
      <UButton
        label="Salvar"
        :loading="saving"
        data-testid="cenario-editar-salvar"
        @click="save"
      />
    </template>
  </BaseModal>
</template>
