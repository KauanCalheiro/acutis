<script setup lang="ts">
import type { GeneratedAuthSetup } from '#shared/contracts/auth'
import type { ScenarioDetail, TestDraft } from '~/types/project'
import type { RecorderEvent } from '~/composables/webdriver'

interface ScenarioReviewModal {
  slug: string
  isPublic?: boolean
  /** O cenário que a gravação sobrescreve; ausente, a revisão cria um cenário novo. */
  scenario?: ScenarioDetail | null
}

const { slug, isPublic = false, scenario = null } = defineProps<ScenarioReviewModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  generated: [result?: ScenarioDetail | GeneratedAuthSetup]
  rerecord: []
  resume: [events: RecorderEvent[]]
}>()

const isAuth = computed(() => scenario?.is_auth === true)
const scenarioId = computed(() => scenario!.spec.replace(/^tests\//, '').replace(/\.(spec|setup)\.ts$/, ''))

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
  if (step.value === 'edit') return 'Revise os contextos'
  if (isAuth.value) return 'Revise a gravação do login'

  return scenario ? 'Revise a gravação retomada' : 'Revise seus eventos'
})

const generateLabel = computed(() => isAuth.value ? 'Gerar autenticação' : 'Gerar cenário')

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

const mappedEvents = computed(() => toRecordedEvents(timeline.value))

/** A autenticação não tem contexto para revisar: sai da revisão direto para o auth.setup.ts. */
async function recordAuth() {
  try {
    const generated = await $fetch<GeneratedAuthSetup>(`/api/projects/${slug}/auth/record`, {
      method: 'POST',
      body: { baseUrl: baseUrl.value, events: mappedEvents.value }
    })
    open.value = false
    emit('generated', generated)
  } catch (err) {
    console.error('Falha ao gravar a autenticação:', err)
    error.value = extractServerError(err, 'Não foi possível gerar a autenticação a partir da gravação.')
    step.value = 'review'
  }
}

async function generate() {
  if (!baseUrl.value) {
    error.value = 'Nenhuma navegação registrada na gravação.'
    return
  }

  error.value = null
  step.value = 'loading'

  if (isAuth.value) return recordAuth()

  try {
    const generated = await $fetch<TestDraft>(`/api/projects/${slug}/tests/draft`, {
      method: 'POST',
      body: {
        baseUrl: baseUrl.value,
        events: mappedEvents.value,
        isPublic
      }
    })

    draft.value = scenario
      ? { ...generated, title: scenario.title, path: scenarioId.value, domain: scenario.domain ?? '' }
      : generated
    step.value = 'edit'
  } catch (err) {
    error.value = extractServerError(err, 'Não foi possível gerar o cenário. Tente novamente.')
    step.value = 'review'
  }
}

async function commit() {
  if (!draft.value) return

  submitting.value = true
  error.value = null

  try {
    const saved = await $fetch<ScenarioDetail>(
      scenario ? `/api/projects/${slug}/scenarios/${scenarioId.value}` : `/api/projects/${slug}/tests`,
      {
        method: scenario ? 'PATCH' : 'POST',
        body: { ...draft.value, events: mappedEvents.value }
      }
    )
    open.value = false
    emit('generated', saved)
  } catch (err) {
    error.value = extractServerError(err, 'Não foi possível salvar o cenário. Tente novamente.')
  } finally {
    submitting.value = false
  }
}

function rerecord() {
  open.value = false
  emit('rerecord')
}

/** Retomar do passo escolhido mantém o que veio antes dele e descarta ele e os seguintes. */
function resume(index: number) {
  open.value = false
  emit('resume', timeline.value.slice(0, index))
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="modalTitle"
    :dismissable="false"
    :loading="step === 'loading'"
    wide
  >
    <template #body>
      <ScenarioReviewLoading
        v-if="step === 'loading'"
        :auth="isAuth"
      />

      <template v-else-if="step === 'edit'">
        <ScenarioWarnings
          :warnings="draft.warnings"
          :slug="slug"
          class="mb-4"
        />

        <ScenarioReviewContexts
          v-model:draft="draft"
          novo
        />
      </template>

      <ScenarioReviewTimeline
        v-else
        :events="timeline"
        :video-src="state.videoSessionId ? `${url}/recording/${state.videoSessionId}` : null"
        :recording-started-at="state.recordingStartedAt"
        resumable
        @resume="resume"
      />

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :description="error"
        class="mt-4"
        data-testid="revisao-erro"
      />
    </template>

    <template #footer>
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
          :label="generateLabel"
          data-testid="revisao-gerar"
          @click="generate"
        />
      </template>
    </template>
  </BaseModal>
</template>
