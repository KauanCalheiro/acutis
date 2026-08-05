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

const {
  steps,
  running,
  passed: runPassed,
  live: liveRun,
  videoUrl,
  testedAt,
  output: runOutput,
  failedStep,
  start: startRun
} = useRunStream(() => slug.value)

const runOpen = ref(false)
const executedPlaywright = ref<string | null>(null)

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
  executedPlaywright.value = null
  fix.value = null
  fixError.value = null

  startRun(scenario.value!.spec, refreshScenario)
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
      v-if="scenario!.tags.length"
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
      <template v-if="tab === 'eventos'">
        <BaseEmpty
          v-if="scenario!.events.length === 0"
          icon="i-ic-round-timeline"
          title="Nenhum evento gravado"
          description="Este cenário foi escrito direto em código, sem passar por uma gravação de navegador."
          testid="cenario-eventos-vazio"
        />
        <ScenarioReviewTimeline
          v-else
          :events="scenario!.events"
          data-testid="cenario-eventos"
        />
      </template>

      <template v-else-if="tab === 'gherkin'">
        <BaseEmpty
          v-if="!scenario!.gherkin"
          icon="i-ic-round-description"
          title="Sem descrição em Gherkin"
          description="Este cenário não tem arquivo .feature, só o código Playwright da aba ao lado."
          testid="cenario-gherkin-vazio"
        />
        <BaseCodefield
          v-else
          :model-value="scenario!.gherkin"
          language="gherkin"
          readonly
          testid="cenario-gherkin"
        />
      </template>

      <template v-else>
        <BaseEmpty
          v-if="!scenario!.playwright.trim()"
          icon="i-ic-round-code-off"
          title="Sem código Playwright"
          description="O arquivo .spec.ts deste cenário está vazio. Edite o cenário pra escrever o teste."
          testid="cenario-playwright-vazio"
        />
        <BaseCodefield
          v-else
          :model-value="scenario!.playwright"
          language="typescript"
          readonly
          testid="cenario-playwright"
        />
      </template>
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
      :output="runOutput"
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
