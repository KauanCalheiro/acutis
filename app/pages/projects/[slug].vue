<script setup lang="ts">
import type { EnvironmentList, ProjectDetail, Scenario } from '~/types/project'
import type { RecorderEvent } from '~/composables/webdriver'
import { navigateTo } from '#app'
import { GIT_CONFLICT_HINT, GIT_UNAVAILABLE_HINT } from '~/composables/git-sync'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

const { data: project, error, refresh } = await useFetch<ProjectDetail>(`/api/projects/${slug.value}`)

if (error.value || !project.value) {
  throw createError({
    statusCode: 404,
    message: 'Projeto não encontrado.'
  })
}

const origin = computed(() => projectOrigin(project.value!))

const updatedAt = computed(() => new Date(project.value!.updated_at).toLocaleString('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
}))

const search = ref('')

const scenarios = computed(() => {
  const term = search.value.trim().toLowerCase()
  const all = project.value?.scenarios ?? []
  if (!term) return all
  return all.filter(scenario =>
    scenario.title.toLowerCase().includes(term)
    || scenario.tags.some(tag => tag.toLowerCase().includes(term))
  )
})

/** O cenário pausado fica na listagem, mas fora da execução: o Playwright não roda ele. */
const runnable = computed(() => scenarios.value.filter(scenario => !scenario.skipped))

/** O que o SSR pede antes de medir a tela: três colunas por três linhas cabem na maioria. */
const DEFAULT_PAGE_SIZE = 9

const pageSize = ref(DEFAULT_PAGE_SIZE)
const page = ref(1)
const grid = ref<HTMLElement>()

const paginated = computed(() => scenarios.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

watch(scenarios, () => {
  page.value = 1
})

/** Quantos cards cabem na altura que sobra da tela, medindo o card e a grade do DOM. */
function fitPageSize() {
  const gridEl = grid.value
  const card = gridEl?.firstElementChild

  if (!gridEl || !card) return

  const style = getComputedStyle(gridEl)
  const gap = Number.parseFloat(style.rowGap) || 0
  const columns = style.gridTemplateColumns.split(' ').length
  const cardHeight = card.getBoundingClientRect().height

  // Card sem altura é card que ainda não pintou.
  if (cardHeight <= 0) return

  const free = window.innerHeight - gridEl.getBoundingClientRect().top - 96
  const rows = Math.max(1, Math.floor((free + gap) / (cardHeight + gap)))
  const fits = rows * columns

  if (fits === pageSize.value) return

  page.value = 1
  pageSize.value = fits
}

watch(paginated, () => nextTick(fitPageSize))

onMounted(() => {
  fitPageSize()
  window.addEventListener('resize', fitPageSize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitPageSize)
})

const filteredRun = useRunStream(() => slug.value)
const filteredRunOpen = ref(false)

/** O que roda é o que está na tela: os títulos filtrados viram o `--grep` do Playwright. */
function runFiltered() {
  filteredRunOpen.value = true
  filteredRun.start({
    grep: runnable.value.map(scenario => scenario.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
    filter: search.value.trim() || undefined
  })
}

/** Rodar um cenário só, pelo menu do card: é a mesma tela de resultado da execução filtrada. */
function runOne(scenario: Scenario) {
  filteredRunOpen.value = true
  filteredRun.start({ spec: scenario.spec })
}

const notify = useNotify()

async function toggleSkip(scenario: Scenario) {
  const id = scenarioIdOf(scenario)

  try {
    await $fetch(`/api/projects/${slug.value}/scenario-skip`, {
      method: 'PATCH',
      body: {
        scenarioId: id,
        skipped: !scenario.skipped
      }
    })
    notify.success(scenario.skipped ? 'Cenário voltou a rodar.' : 'Cenário pausado.')
    await refresh()
  } catch (error) {
    notify.failure(error, 'Não foi possível mudar o cenário.')
  }
}

const removingScenario = ref<Scenario | null>(null)
const removingScenarioBusy = ref(false)

function askRemoval(scenario: Scenario) {
  removingScenario.value = scenario
}

async function removeScenario() {
  const scenario = removingScenario.value!
  removingScenarioBusy.value = true

  try {
    await $fetch(`/api/projects/${slug.value}/scenarios/${scenarioIdOf(scenario)}`, {
      method: 'DELETE'
    })
    removingScenario.value = null
    notify.success('Cenário excluído.')
    await refresh()
  } catch (error) {
    notify.failure(error, 'Não foi possível excluir o cenário.')
  } finally {
    removingScenarioBusy.value = false
  }
}

function scenarioIdOf(scenario: Scenario) {
  return scenario.spec.replace(/^tests\//, '').replace(/\.spec\.ts$/, '')
}

const { conflict: gitConflict, unavailable: gitUnavailable, sync: syncGit } = useGitSync(slug.value)

async function syncLatest() {
  const result = await syncGit()
  if (result?.changed) await refresh()
}

onMounted(() => {
  void syncLatest()
})

// O refresh troca o objeto mesmo quando só reescreveu um arquivo existente, ao contrário do mtime
// do diretório. A ação continua sem esperar pela rede.
watch(project, () => {
  void syncLatest()
})

const gitAttention = computed(() => gitConflict.value || gitUnavailable.value)
const gitHint = computed(() => gitConflict.value ? GIT_CONFLICT_HINT : GIT_UNAVAILABLE_HINT)

const settingsOpen = ref(false)

/** O modal de configurações abre sozinho no projeto que ainda não tem URL base. */
onMounted(() => {
  if (project.value?.requires_url) settingsOpen.value = true
})

const environmentsOpen = ref(false)

const { data: environmentList } = await useFetch<EnvironmentList>(
  () => `/api/projects/${slug.value}/environments`,
  { key: `environments-${slug.value}` }
)

/** Variável sem valor no ambiente ativo derruba a execução, e a falha não diz que o motivo é este. */
const pendingVars = computed(() => {
  const list = environmentList.value
  const active = list?.environments.find(environment => environment.slug === list.active)

  return (active?.vars ?? []).filter(variable => variable.pending).map(variable => variable.key)
})

/** `?environment` abre o modal, que é para onde a ressalva de variável sem valor aponta. */
onMounted(() => {
  if (useRoute().query.environment !== undefined) environmentsOpen.value = true
})

async function onEnvironmentsSaved() {
  await refreshNuxtData(`environments-${slug.value}`)
  await refresh()
}
const removeOpen = ref(false)
const removing = ref(false)
const skippingAuth = ref(false)

const AUTH_SPEC = 'tests/auth.setup.ts'
const authPage = computed(() => `/projects/${slug.value}/scenarios/auth`)

const authRun = useRunStream(() => slug.value)
const authRunOpen = ref(false)

const authButtonColor = computed(() => ({
  configured: 'success',
  failing: 'error',
  unset: 'neutral',
  skipped: 'neutral'
}[project.value!.auth_status] as 'success' | 'error' | 'neutral'))

async function skipAuth() {
  skippingAuth.value = true

  try {
    await $fetch(`/api/projects/${slug.value}/auth/skip`, {
      method: 'POST'
    })
    await refresh()
  } finally {
    skippingAuth.value = false
  }
}

const { state: webdriver, startRecording, stopRecording } = useWebdriver()
const reviewOpen = ref(false)

/** `public` marca o cenário com @publico e o faz rodar fora da sessão; `plain` não carimba nada. */
type RecordingMode = 'plain' | 'public' | 'authenticated'

const recordingMode = ref<RecordingMode>('plain')
const recordingPublic = computed(() => recordingMode.value === 'public')

const hasAuth = computed(() => project.value!.auth_status === 'configured' || project.value!.auth_status === 'failing')

const recordingOptions = computed(() => [[
  {
    label: 'Cenário autenticado',
    description: 'Entra no sistema antes de gravar',
    icon: 'i-ic-round-lock',
    testid: 'cenario-novo-autenticado',
    onSelect: () => recordAuthenticated()
  },
  {
    label: 'Cenário público',
    description: 'Grava sem sessão (login, cadastro, landing)',
    icon: 'i-ic-round-public',
    testid: 'cenario-novo-publico',
    onSelect: () => recordPublic()
  }
]])

/** URL base configurada no projeto. É onde o navegador abre ao gravar. */
const projectUrl = computed(() => project.value!.base_url ?? undefined)

function recordPlain(replay?: RecorderEvent[]) {
  recordingMode.value = 'plain'
  startRecording('scenario', { url: projectUrl.value, replay })
}

function recordPublic(replay?: RecorderEvent[]) {
  recordingMode.value = 'public'
  startRecording('scenario', { url: projectUrl.value, replay })
}

/** Roda o auth.setup.ts antes de abrir o navegador; falhou o login, não abre. */
function recordAuthenticated(replay?: RecorderEvent[]) {
  recordingMode.value = 'authenticated'
  authRunOpen.value = true
  authRun.start({ spec: AUTH_SPEC }, () => {
    refresh()

    if (!authRun.passed.value) return

    authRunOpen.value = false
    startRecording('scenario', {
      storageState: project.value!.storage_state,
      url: projectUrl.value,
      replay
    })
  })
}

/** Atalho de um clique (card de estado vazio): num projeto com login, autenticado é o caso comum. */
function recordDefault() {
  return hasAuth.value ? recordAuthenticated() : recordPlain()
}

/** `?gravar` já abre gravando, que é por onde o menu do card entra na tela. */
onMounted(() => {
  const gravar = route.query.gravar

  if (gravar === 'publico') recordPublic()
  if (gravar === 'autenticado') recordAuthenticated()
})

/**
 * Regravar mantém o tipo escolhido, porque trocar de autenticado pra público no meio seria surpresa.
 * Com passos anteriores, o navegador refaz esses e a gravação continua de onde o usuário parou.
 */
function recordAgain(replay?: RecorderEvent[]) {
  if (recordingMode.value === 'authenticated') return recordAuthenticated(replay)
  if (recordingMode.value === 'public') return recordPublic(replay)

  recordPlain(replay)
}

watch(() => webdriver.value.videoSessionId, (sessionId) => {
  if (!sessionId) return

  reviewOpen.value = true
})

/** Enquanto a ferramenta refaz os passos, quem manda é a cortina na janela gravada. */
const recordingLabel = computed(() => {
  if (webdriver.value.replayFailedStep) return 'Aguardando você na janela'
  if (webdriver.value.replaying) return 'Refazendo os passos'

  return 'Parar gravação'
})

function stopAndReview() {
  stopRecording()
}

function onRenamed(newSlug: string) {
  navigateTo(`/projects/${newSlug}`)
}

async function remove() {
  removing.value = true

  try {
    await $fetch(`/api/projects/${slug.value}`, {
      method: 'DELETE'
    })
    await navigateTo('/')
  } finally {
    removing.value = false
  }
}
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
            to="/"
            data-testid="projeto-voltar"
          />
          <UBadge
            :icon="origin.icon"
            :label="origin.label"
            data-testid="projeto-origem"
          />
        </div>
        <ProjectRenameInline
          :slug="slug"
          :name="project!.name"
          @renamed="onRenamed"
        />
        <p
          class="text-sm text-muted italic truncate"
          :title="project!.repository ?? undefined"
          data-testid="projeto-caminho"
        >
          {{ project!.path }}
        </p>
        <p
          v-if="project!.branch"
          class="text-sm"
          data-testid="projeto-branch"
        >
          Branch: <span class="font-medium">{{ project!.branch }}</span>
        </p>
        <p class="text-xs text-dimmed">
          Última modificação: {{ updatedAt }}
        </p>
      </div>

      <div class="flex gap-2 shrink-0">
        <ProjectEnvironmentsSelect
          :slug="slug"
          @edit="environmentsOpen = true"
          @activated="refresh()"
        />
        <BaseButtonIcon
          icon="i-ic-round-key"
          label="Autenticação"
          :color="authButtonColor"
          variant="soft"
          :to="authPage"
          data-testid="projeto-auth"
        />
        <BaseButtonIcon
          v-if="project!.has_report"
          icon="i-ic-round-assessment"
          label="Relatório das execuções"
          color="neutral"
          variant="soft"
          :to="`/projects/${slug}/report`"
          data-testid="projeto-relatorio"
        />
        <UChip
          :show="gitAttention"
          :color="gitConflict ? 'error' : 'warning'"
          size="lg"
        >
          <BaseButtonIcon
            icon="i-simple-icons-visualstudiocode"
            :label="gitAttention ? gitHint : 'Abrir no VS Code'"
            color="neutral"
            variant="soft"
            :to="project!.vscode_url"
            target="_blank"
            data-testid="projeto-vscode"
          />
        </UChip>
        <BaseButtonIcon
          icon="i-ic-round-delete"
          label="Remover projeto"
          color="error"
          variant="soft"
          data-testid="projeto-remover"
          @click="removeOpen = true"
        />
      </div>
    </div>

    <UAlert
      v-if="pendingVars.length"
      color="warning"
      variant="soft"
      icon="i-ic-round-warning"
      class="mt-6"
      title="Variáveis do ambiente sem valor"
      :description="`A execução vai falhar até ${pendingVars.join(', ')} receber valor no ambiente ativo.`"
      data-testid="projeto-variaveis-aviso"
      :ui="{ actions: 'justify-end' }"
    >
      <template #actions>
        <UButton
          label="Preencher"
          size="md"
          color="neutral"
          variant="link"
          data-testid="projeto-variaveis-preencher"
          @click="environmentsOpen = true"
        />
      </template>
    </UAlert>

    <UAlert
      v-if="project!.auth_status === 'unset'"
      color="warning"
      variant="soft"
      icon="i-ic-round-warning"
      class="mt-6"
      title="Sem autenticação configurada"
      description="Cenários gravados após um login vão falhar na verificação até a autenticação ser configurada."
      data-testid="projeto-auth-aviso"
      :ui="{ actions: 'justify-end' }"
    >
      <template #actions>
        <UButton
          label="Não precisa de login"
          size="md"
          color="neutral"
          variant="link"
          :loading="skippingAuth"
          data-testid="projeto-auth-dispensar"
          @click="skipAuth"
        />
        <UButton
          label="Configurar"
          size="md"
          color="warning"
          :to="authPage"
          data-testid="projeto-auth-configurar"
        />
      </template>
    </UAlert>

    <UAlert
      v-else-if="project!.auth_status === 'failing'"
      color="error"
      variant="soft"
      icon="i-ic-round-error"
      class="mt-6"
      title="A autenticação não está funcionando"
      description="A última execução do login falhou. Todo cenário deste projeto roda o login antes, então eles vão falhar junto até isso ser resolvido."
      data-testid="projeto-auth-falhando"
      :ui="{ actions: 'justify-end' }"
    >
      <template #actions>
        <UButton
          label="Ver autenticação"
          size="md"
          color="error"
          :to="authPage"
          data-testid="projeto-auth-revisar"
        />
      </template>
    </UAlert>

    <div class="flex flex-wrap items-center gap-4 mt-8 mb-8">
      <UInput
        v-model="search"
        data-testid="cenario-busca"
        icon="i-ic-round-search"
        placeholder="Buscar cenário..."
        class="flex-1 min-w-48"
      />
      <UButton
        :label="`Rodar ${runnable.length} filtrados`"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        :disabled="!runnable.length"
        :loading="filteredRun.running.value"
        data-testid="projeto-rodar-filtrados"
        @click="runFiltered"
      />
      <UDropdownMenu
        v-if="!webdriver.recording && hasAuth"
        :items="recordingOptions"
      >
        <UButton
          data-testid="cenario-novo"
          label="Novo cenário"
          trailing-icon="i-ic-round-expand-more"
          :disabled="!webdriver.connected"
        />
        <template #item-label="{ item }">
          <span :data-testid="item.testid">{{ item.label }}</span>
        </template>
      </UDropdownMenu>
      <UButton
        v-else-if="!webdriver.recording"
        data-testid="cenario-novo"
        label="Novo cenário"
        trailing-icon="i-ic-round-add"
        :disabled="!webdriver.connected"
        @click="recordPlain()"
      />
      <UButton
        v-else
        data-testid="cenario-parar"
        :label="recordingLabel"
        trailing-icon="i-ic-round-stop"
        color="error"
        class="animate-pulse"
        :disabled="webdriver.replaying"
        @click="stopAndReview"
      />
    </div>

    <div
      v-if="webdriver.error"
      class="mb-8 flex flex-col gap-3"
    >
      <UAlert
        color="error"
        variant="soft"
        data-testid="webdriver-erro"
        :description="webdriver.error"
      />
      <WebdriverSetup v-if="webdriver.error.includes('Chrome')" />
    </div>

    <ScenarioReviewModal
      v-model:open="reviewOpen"
      :slug="slug"
      :is-public="recordingPublic"
      @generated="refresh()"
      @rerecord="recordAgain"
      @resume="recordAgain"
    />

    <div
      v-if="scenarios.length"
      ref="grid"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <ScenarioCard
        v-for="scenario in paginated"
        :key="scenario.spec"
        :scenario="scenario"
        :slug="slug"
        @run="runOne(scenario)"
        @skip="toggleSkip(scenario)"
        @remove="askRemoval(scenario)"
      />
    </div>

    <div
      v-if="scenarios.length > pageSize"
      class="mt-6 flex justify-center"
    >
      <UPagination
        v-model:page="page"
        variant="soft"
        :total="scenarios.length"
        :items-per-page="pageSize"
        data-testid="cenario-paginacao"
      />
    </div>

    <ScenarioEmpty
      v-else
      :disabled="!webdriver.connected"
      @record="recordDefault"
    />

    <ProjectEnvironmentsModal
      v-model:open="environmentsOpen"
      :slug="slug"
      @saved="onEnvironmentsSaved"
    />

    <ProjectSettingsModal
      v-model:open="settingsOpen"
      :slug="slug"
      :base-url="project!.base_url"
      @saved="refresh()"
    />

    <ProjectRunFilteredModal
      v-model:open="filteredRunOpen"
      :running="filteredRun.running.value"
      :passed="filteredRun.passed.value"
      :tests="filteredRun.tests.value"
      :project-name="project!.name"
      :slug="slug"
      :filter="search"
      :tested-at="filteredRun.testedAt.value"
      :output="filteredRun.output.value"
    />

    <ScenarioTestRunModal
      v-model:open="authRunOpen"
      :running="authRun.running.value"
      :passed="authRun.passed.value"
      :steps="authRun.steps.value"
      :video-url="authRun.videoUrl.value"
      :project-name="project!.name"
      kind="autenticacao"
      running-title="Autenticando"
      :scenario-name="AUTH_SPEC"
      :branch="project!.branch"
      :tested-at="authRun.testedAt.value"
      :output="authRun.output.value"
      @fix="navigateTo(authPage)"
    />

    <BaseConfirm
      :open="removingScenario !== null"
      title="Excluir cenário"
      :description="`Isso apaga os arquivos de teste, feature e eventos de &quot;${removingScenario?.title}&quot;.`"
      confirm-label="Excluir"
      confirm-color="error"
      confirm-testid="cenario-excluir-confirmar"
      :loading="removingScenarioBusy"
      @update:open="removingScenario = $event ? removingScenario : null"
      @confirm="removeScenario"
    />

    <BaseConfirm
      v-model:open="removeOpen"
      title="Remover projeto"
      :description="`Isso apaga a pasta ${project!.path} e todos os testes dentro dela.`"
      confirm-label="Remover"
      confirm-color="error"
      confirm-testid="projeto-remover-confirmar"
      :loading="removing"
      @confirm="remove"
    />
  </UContainer>
</template>
