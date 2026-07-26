<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { ProjectDetail, ScenarioDetail, ScenarioRun, SelectorSuggestion } from '~/types/project'

const route = useRoute()
const slug = computed(() => route.params.projectSlug as string)
const scenarioId = computed(() => (route.params.scenario as string[]).join('/'))

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

const { data: project } = await useFetch<ProjectDetail>(`/api/projects/${slug.value}`)
const { data: scenario, refresh: refreshScenario } = await useFetch<ScenarioDetail>(`/api/projects/${slug.value}/scenarios/${scenarioId.value}`)

if (!project.value || !scenario.value) {
  throw createError({
    statusCode: 404,
    message: 'Cenário não encontrado.'
  })
}

const origin = computed(() => projectOrigin(project.value!))

const removeOpen = ref(false)
const removing = ref(false)

async function remove() {
  removing.value = true

  try {
    await $fetch(`/api/projects/${slug.value}/scenarios/${scenarioId.value}`, {
      method: 'DELETE'
    })
    await navigateTo(`/projects/${slug.value}`)
  } finally {
    removing.value = false
  }
}

const updatedAt = computed(() => new Date(scenario.value!.updated_at).toLocaleString('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
}))

const editOpen = ref(false)
const suggestionsOpen = ref(false)
const suggestionsLoading = ref(false)
const suggestions = ref<SelectorSuggestion[]>([])
const suggestionsError = ref<string | null>(null)

watch(suggestionsOpen, async (isOpen) => {
  if (!isOpen) return

  suggestionsLoading.value = true
  suggestionsError.value = null
  suggestions.value = []

  try {
    suggestions.value = await $fetch<SelectorSuggestion[]>(`/api/projects/${slug.value}/scenario-suggestions`, {
      method: 'POST',
      body: { scenarioId: scenarioId.value }
    })
  } catch (error) {
    suggestionsError.value = extractServerError(error, 'Não foi possível gerar sugestões agora. Tente novamente.')
  } finally {
    suggestionsLoading.value = false
  }
})

function scenarioIdFor(spec: string) {
  return spec.replace(/^tests\//, '').replace(/\.spec\.ts$/, '')
}

async function onUpdated(updated: ScenarioDetail) {
  if (scenarioIdFor(updated.spec) !== scenarioId.value) {
    await navigateTo(`/projects/${slug.value}/scenarios/${scenarioIdFor(updated.spec)}`)
    return
  }

  await refreshScenario()
}

interface TestStep {
  title: string
  status: 'waiting' | 'running' | 'success' | 'failed'
  error?: string | null
}

type RunStreamEvent
  = | { event: 'run:started', steps?: string[] }
    | { event: 'step', title: string, status: 'pending' }
    | { event: 'step', title: string, status: 'success' | 'failed', durationMs: number, error: string | null }
    | { event: 'test', status: 'pending' }
    | { event: 'test', status: 'success' | 'failed' | 'skipped', durationMs: number, error: string | null, videoPath: string | null }
    | { event: 'run:finished', passed: boolean }

const webdriverUrl = useRuntimeConfig().public.webdriver.acutis.url

const runOpen = ref(false)
const running = ref(false)
const steps = ref<TestStep[]>([])
const videoUrl = ref<string | null>(null)
const testedAt = ref<string | null>(null)
const executedPlaywright = ref<string | null>(null)
const runPassed = ref(false)
const liveRun = ref(false)

function videoUrlFor(path: string) {
  return `${webdriverUrl}/runner/video?${new URLSearchParams({ path })}`
}

function formatTestedAt(date: Date) {
  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

function openRun(run: ScenarioRun) {
  steps.value = run.steps.map(step => ({
    title: step.title,
    status: step.status,
    error: step.error
  }))
  videoUrl.value = run.video_path ? videoUrlFor(run.video_path) : null
  testedAt.value = formatTestedAt(new Date(run.started_at))
  executedPlaywright.value = run.playwright
  runPassed.value = run.passed
  liveRun.value = false
  fix.value = null
  fixError.value = null
  running.value = false
  runOpen.value = true
}

const fixOpen = ref(false)
const fixing = ref(false)
const fix = ref<{ playwright: string, summary: string } | null>(null)
const fixError = ref<string | null>(null)
const applyingFix = ref(false)

const failedStep = computed(() => steps.value.find(step => step.status === 'failed'))

async function requestFix() {
  const failed = failedStep.value
  if (!failed) return

  runOpen.value = false
  fixOpen.value = true
  fixing.value = true
  fix.value = null
  fixError.value = null

  try {
    fix.value = await $fetch<{ playwright: string, summary: string }>(`/api/projects/${slug.value}/scenario-fix`, {
      method: 'POST',
      body: { scenarioId: scenarioId.value, step: failed.title, error: failed.error ?? '' }
    })
  } catch (error) {
    fixError.value = extractServerError(error, 'Não foi possível gerar uma correção agora. Tente novamente.')
  } finally {
    fixing.value = false
  }
}

async function applyFix() {
  if (!fix.value) return

  applyingFix.value = true

  try {
    await $fetch(`/api/projects/${slug.value}/scenarios/${scenarioId.value}`, {
      method: 'PATCH',
      body: { ...draftFromScenario(scenario.value!), playwright: fix.value.playwright }
    })

    fix.value = null
    fixOpen.value = false
    await refreshScenario()
  } catch (error) {
    fixError.value = extractServerError(error, 'Não foi possível salvar a correção.')
  } finally {
    applyingFix.value = false
  }
}

function discardFix() {
  fixOpen.value = false
  fix.value = null
  fixError.value = null
}

function runTest() {
  runOpen.value = true
  running.value = true
  steps.value = []
  videoUrl.value = null
  testedAt.value = null
  executedPlaywright.value = null
  runPassed.value = false
  liveRun.value = true
  fix.value = null
  fixError.value = null

  const query = new URLSearchParams({ spec: scenario.value!.spec })
  const source = new EventSource(`/api/projects/${slug.value}/run-stream?${query}`)

  source.onmessage = (message) => {
    const data = JSON.parse(message.data) as RunStreamEvent

    if (data.event === 'run:started') {
      steps.value = (data.steps ?? []).map(title => ({ title, status: 'waiting' }))
    }

    if (data.event === 'step') {
      if (data.status === 'pending') {
        const waiting = steps.value.findIndex(step => step.title === data.title && step.status === 'waiting')
        if (waiting === -1) steps.value = [...steps.value, { title: data.title, status: 'running' }]
        else steps.value[waiting] = { title: data.title, status: 'running' }
        return
      }

      const index = steps.value.findLastIndex(step => step.title === data.title && step.status === 'running')
      if (index !== -1) steps.value[index] = { title: data.title, status: data.status, error: data.error }
    }

    if (data.event === 'test' && data.status !== 'pending' && data.videoPath) {
      videoUrl.value = videoUrlFor(data.videoPath)
    }

    if (data.event === 'run:finished') {
      source.close()
      running.value = false
      runPassed.value = data.passed
      testedAt.value = formatTestedAt(new Date())
      refreshScenario()
    }
  }

  source.onerror = () => {
    source.close()
    running.value = false
    testedAt.value = formatTestedAt(new Date())
    if (steps.value.length === 0) steps.value = [{ title: 'Não foi possível executar o teste.', status: 'failed' }]
  }
}

const tab = ref('eventos')
const tabs: TabsItem[] = [
  { label: 'Eventos', value: 'eventos' },
  { label: 'Gherkin', value: 'gherkin' },
  { label: 'Playwright', value: 'playwright' }
]
</script>

<template>
  <UContainer
    :data-hydrated="hydrated"
    class="py-6 lg:py-10"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1 min-w-0">
        <div class="flex items-center gap-2">
          <BaseButtonIcon
            icon="i-ic-round-arrow-back"
            label="Voltar"
            variant="ghost"
            color="neutral"
            :to="`/projects/${slug}`"
            data-testid="cenario-voltar"
          />
          <UBadge
            :icon="origin.icon"
            :label="origin.label"
            data-testid="cenario-origem"
          />
        </div>
        <h1
          class="text-2xl font-bold truncate"
          data-testid="cenario-titulo"
        >
          {{ scenario!.title }}
        </h1>
        <p
          class="text-sm text-muted italic truncate"
          data-testid="cenario-caminho"
        >
          {{ scenario!.spec }}
        </p>
      </div>

      <div class="flex gap-2 shrink-0">
        <BaseButtonIcon
          icon="i-ic-round-delete"
          label="Excluir"
          color="error"
          variant="soft"
          data-testid="cenario-excluir"
          @click="removeOpen = true"
        />
        <BaseButtonIcon
          icon="i-ic-round-edit"
          label="Editar"
          color="neutral"
          variant="soft"
          data-testid="cenario-editar"
          @click="editOpen = true"
        />
        <UButton
          label="Ver sugestões"
          trailing-icon="i-ic-round-auto-awesome"
          color="neutral"
          variant="soft"
          data-testid="cenario-sugestoes"
          @click="suggestionsOpen = true"
        />
        <UButton
          label="Testar"
          trailing-icon="i-ic-round-play-arrow"
          :loading="running"
          data-testid="cenario-testar"
          @click="runTest"
        />
      </div>
    </div>

    <div
      class="flex flex-wrap gap-1 mt-4"
      data-testid="cenario-tags"
    >
      <UBadge
        v-for="tag in scenario!.tags"
        :key="tag"
        :color="tagColor(tag)"
        :label="tag"
      />
    </div>
    <p class="text-xs text-dimmed mt-2">
      Última modificação: {{ updatedAt }}
    </p>

    <UTabs
      v-model="tab"
      :items="tabs"
      :content="false"
      class="w-full mt-8"
    >
      <template #default="{ item }">
        <span :data-testid="`cenario-tab-${item.value}`">{{ item.label }}</span>
      </template>
    </UTabs>

    <div class="mt-4">
      <ScenarioReviewTimeline
        v-if="tab === 'eventos'"
        :events="scenario!.events"
        data-testid="cenario-eventos"
      />
      <BaseCodefield
        v-else-if="tab === 'gherkin'"
        :model-value="scenario!.gherkin ?? ''"
        language="gherkin"
        readonly
        testid="cenario-gherkin"
      />
      <BaseCodefield
        v-else
        :model-value="scenario!.playwright"
        language="typescript"
        readonly
        testid="cenario-playwright"
      />
    </div>

    <ScenarioTestRunHistory
      :runs="scenario!.runs"
      @open="openRun"
    />

    <BaseConfirm
      v-model:open="removeOpen"
      title="Excluir cenário"
      confirm-label="Excluir"
      confirm-color="error"
      confirm-testid="cenario-excluir-confirmar"
      :loading="removing"
      @confirm="remove"
    >
      <template #description>
        Isso <b>apaga</b> os arquivos de teste, feature e eventos de "{{ scenario!.title }}".
      </template>
    </BaseConfirm>

    <ScenarioEditModal
      v-model:open="editOpen"
      :slug="slug"
      :scenario="scenario!"
      @updated="onUpdated"
    />

    <ScenarioSuggestionsModal
      v-model:open="suggestionsOpen"
      :loading="suggestionsLoading"
      :suggestions="suggestions"
      :error="suggestionsError"
    />

    <ScenarioTestRunModal
      v-model:open="runOpen"
      :running="running"
      :live="liveRun"
      :passed="runPassed"
      :steps="steps"
      :video-url="videoUrl"
      :project-name="project!.name"
      :scenario-name="scenario!.title"
      :branch="project!.branch"
      :tested-at="testedAt"
      :playwright="executedPlaywright"
      @fix="requestFix"
    />

    <ScenarioFixModal
      v-model:open="fixOpen"
      :loading="fixing"
      :fix="fix"
      :error="fixError"
      :applying="applyingFix"
      @apply="applyFix"
      @discard="discardFix"
    />
  </UContainer>
</template>
