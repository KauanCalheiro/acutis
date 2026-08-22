<script setup lang="ts">
import type { ScenarioDetail, TestDraft } from '~/types/project'
import type { RecorderEvent } from '~/composables/webdriver'

interface ScenarioEditModal {
  slug: string
  scenario: ScenarioDetail
  /** O que uma gravação retomada gerou: entra no lugar do que está em disco. */
  resumed?: { draft: TestDraft, events: RecorderEvent[] } | null
}

const { slug, scenario, resumed = null } = defineProps<ScenarioEditModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  updated: [scenario: ScenarioDetail]
}>()

const draft = ref<TestDraft>(resumed?.draft ?? draftFromScenario(scenario))
const saving = ref(false)
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) {
    draft.value = resumed?.draft ?? draftFromScenario(scenario)
    error.value = null
  }
})

const scenarioId = computed(() => scenario.spec.replace(/^tests\//, '').replace(/\.(spec|setup)\.ts$/, ''))

async function save() {
  saving.value = true
  error.value = null

  try {
    const updated = await $fetch<ScenarioDetail>(`/api/projects/${slug}/scenarios/${scenarioId.value}`, {
      method: 'PATCH',
      body: { ...draft.value, events: resumed?.events }
    })
    open.value = false
    emit('updated', updated)
  } catch (err) {
    error.value = extractServerError(err, 'Não foi possível salvar o cenário.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="scenario.is_auth ? 'Editar autenticação' : 'Editar cenário'"
    wide
  >
    <template #body>
      <ScenarioReviewContexts
        v-model:draft="draft"
        :is-auth="scenario.is_auth"
      />

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
