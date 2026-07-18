<script setup lang="ts">
import type { TestDraft } from '~/types/project'

interface ScenarioReviewModal {
  slug: string
}

const { slug } = defineProps<ScenarioReviewModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  generated: []
  rerecord: []
}>()

const { state, url } = useWebdriver()

function emptyDraft(): TestDraft {
  return { title: '', tags: [], domain: '', path: '', gherkin: '', playwright: '' }
}

const step = ref<'review' | 'loading' | 'edit'>('review')
const draft = ref<TestDraft>(emptyDraft())
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) {
    step.value = 'review'
    draft.value = emptyDraft()
    error.value = null
  }
})

const modalTitle = computed(() => {
  if (step.value === 'loading') return 'Gerando cenário'
  if (step.value === 'edit') return 'Revise os contextos'
  return 'Revise seus eventos'
})

const timeline = computed(() =>
  state.value.events
    .filter(event => event.type && event.timestamp)
    .sort((a, b) => a.timestamp! - b.timestamp!)
)

const submitting = ref(false)

const baseUrl = computed(() => {
  const first = timeline.value.find(event => event.url)
  if (!first?.url) return null
  try {
    return new URL(first.url).origin
  } catch {
    return null
  }
})

const mappedEvents = computed(() => timeline.value.map(event => ({
  type: event.type,
  timestamp: event.timestamp,
  url: event.url ?? null,
  selectors: event.selectors ?? null,
  label: event.label ?? null,
  value: event.value ?? null,
  sensitive: event.sensitive ?? false
})))

async function generate() {
  if (!baseUrl.value) {
    error.value = 'Nenhuma navegação registrada na gravação.'
    return
  }

  error.value = null
  step.value = 'loading'

  try {
    draft.value = await $fetch<TestDraft>(`/api/projects/${slug}/tests/draft`, {
      method: 'POST',
      body: {
        baseUrl: baseUrl.value,
        events: mappedEvents.value
      }
    })
    step.value = 'edit'
  } catch {
    error.value = 'Não foi possível gerar o cenário. Tente novamente.'
    step.value = 'review'
  }
}

async function commit() {
  if (!draft.value) return

  submitting.value = true
  error.value = null

  try {
    await $fetch(`/api/projects/${slug}/tests`, {
      method: 'POST',
      body: { ...draft.value, events: mappedEvents.value }
    })
    open.value = false
    emit('generated')
  } catch {
    error.value = 'Não foi possível salvar o cenário. Tente novamente.'
  } finally {
    submitting.value = false
  }
}

function rerecord() {
  open.value = false
  emit('rerecord')
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="modalTitle"
    :dismissable="false"
    wide
  >
    <template #body>
      <ScenarioReviewLoading v-if="step === 'loading'" />

      <ScenarioReviewContexts
        v-else-if="step === 'edit'"
        v-model:draft="draft"
      />

      <ScenarioReviewTimeline
        v-else
        :events="timeline"
        :video-src="state.videoSessionId ? `${url}/recording/${state.videoSessionId}` : null"
        :recording-started-at="state.recordingStartedAt"
      />

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :description="error"
        class="mt-4"
      />
    </template>

    <template
      v-if="step !== 'loading'"
      #footer
    >
      <template v-if="step === 'edit'">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          data-testid="contexto-cancelar"
          @click="open = false"
        />
        <UButton
          label="Enviar"
          :loading="submitting"
          data-testid="contexto-enviar"
          @click="commit"
        />
      </template>

      <template v-else>
        <UButton
          label="Gravar novamente"
          color="neutral"
          variant="soft"
          class="mr-auto"
          data-testid="revisao-regravar"
          @click="rerecord"
        />
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          data-testid="revisao-cancelar"
          @click="open = false"
        />
        <UButton
          label="Gerar cenário"
          data-testid="revisao-gerar"
          @click="generate"
        />
      </template>
    </template>
  </BaseModal>
</template>
