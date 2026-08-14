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

const { data: project, refresh: refreshProject } = await useFetch<ProjectDetail>(`/api/projects/${slug.value}`)
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

const { configured: aiConfigured } = useAi()

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
  return spec.replace(/^tests\//, '').replace(/\.(spec|setup)\.ts$/, '')
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

  startRun(scenario.value!.spec, async () => {
    await refreshScenario()

    // É a execução do login que decide o status de autenticação do projeto.
    if (isAuth.value) await refreshProject()
  })
}

const tab = ref('eventos')

/** O Gherkin é opcional: sem arquivo .feature não há aba, e não uma aba que só diz "vazio". */
const tabs = computed<TabsItem[]>(() => [
  { label: 'Eventos', value: 'eventos' },
  ...(scenario.value!.gherkin ? [{ label: 'Gherkin', value: 'gherkin' }] : []),
  { label: 'Playwright', value: 'playwright' },
  { label: 'Execuções', value: 'execucoes' }
])

/** Apagar o Gherkin na edição leva a aba embora, e ela não pode continuar sendo a aberta. */
watch(() => scenario.value!.gherkin, (gherkin) => {
  if (!gherkin && tab.value === 'gherkin') tab.value = 'eventos'
})

const isAuth = computed(() => scenario.value!.is_auth)

/** Sem login gravado a tela não tem cenário nenhum pra mostrar: ela é o convite pra gravar. */
const written = computed(() => !isAuth.value || scenario.value!.playwright.trim().length > 0)

const { state: webdriver, startRecording, stopRecording } = useWebdriver()
const credentialsOpen = ref(false)
const writingAuth = ref(false)
const authError = ref<string | null>(null)
const authWarnings = ref<string[]>([])
const dismissingAuth = ref(false)

async function dismissAuth() {
  dismissingAuth.value = true

  try {
    await $fetch(`/api/projects/${slug.value}/auth/skip`, {
      method: 'POST'
    })
    await refreshProject()
  } finally {
    dismissingAuth.value = false
  }
}

const AUTH_PHRASES = [
  'Analisando os eventos gravados',
  'Identificando os campos de usuário e senha',
  'Escrevendo o fluxo de autenticação'
]

/** Gravar o login abre no sistema sem sessão, porque é justamente o login que vamos capturar. */
function recordLogin() {
  authError.value = null
  authWarnings.value = []
  startRecording('auth', { url: project.value!.base_url ?? undefined })
}

watch(() => webdriver.value.videoSessionId, async (sessionId) => {
  if (!sessionId || !isAuth.value) return

  const baseUrl = eventsBaseUrl(webdriver.value.events)

  if (!baseUrl) {
    authError.value = 'A gravação não registrou nenhuma página. Tente gravar novamente.'
    return
  }

  writingAuth.value = true

  try {
    const response = await $fetch<{ authSetup: string, credentialsNeeded: boolean, warnings?: string[] }>(`/api/projects/${slug.value}/auth/record`, {
      method: 'POST',
      body: {
        baseUrl,
        events: webdriver.value.events.map(event => ({
          type: event.type,
          timestamp: event.timestamp,
          url: event.url ?? null,
          selectors: event.selectors ?? null,
          label: event.label ?? null,
          value: event.value ?? null,
          inputType: event.inputType ?? null,
          html: event.html ?? null
        }))
      }
    })

    authWarnings.value = response.warnings ?? []

    await refreshScenario()

    if (response.credentialsNeeded) {
      credentialsOpen.value = true
      return
    }

    runTest()
  } catch (error) {
    console.error('Falha ao gravar a autenticação:', error)
    authError.value = 'Não foi possível gerar a autenticação a partir da gravação. Tente novamente.'
  } finally {
    writingAuth.value = false
  }
})
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
          <ScenarioAuthStatus
            v-if="isAuth"
            :status="project!.auth_status"
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
          v-if="!isAuth"
          icon="i-ic-round-delete"
          label="Excluir"
          color="error"
          variant="soft"
          data-testid="cenario-excluir"
          @click="removeOpen = true"
        />
        <BaseButtonIcon
          v-if="written"
          icon="i-ic-round-edit"
          label="Editar"
          color="neutral"
          variant="soft"
          data-testid="cenario-editar"
          @click="editOpen = true"
        />
        <UTooltip
          v-if="!isAuth"
          :text="AI_OFF_HINT"
          :disabled="aiConfigured"
          :delay-duration="0"
          arrow
        >
          <!-- O botão desabilitado não dispara evento de mouse: quem recebe o hover é o span. -->
          <span>
            <UButton
              label="Ver sugestões"
              trailing-icon="i-ic-round-auto-awesome"
              color="neutral"
              variant="soft"
              :disabled="!aiConfigured"
              :class="aiConfigured ? '' : 'pointer-events-none'"
              data-testid="cenario-sugestoes"
              @click="suggestionsOpen = true"
            />
          </span>
        </UTooltip>
        <UButton
          v-if="isAuth && webdriver.recording"
          label="Parar gravação"
          trailing-icon="i-ic-round-stop"
          color="error"
          class="animate-pulse"
          data-testid="cenario-parar"
          @click="stopRecording"
        />
        <UButton
          v-else-if="isAuth && written"
          label="Gravar novamente"
          trailing-icon="i-ic-round-fiber-manual-record"
          color="neutral"
          variant="soft"
          :disabled="!webdriver.connected"
          :loading="writingAuth"
          data-testid="auth-gravar"
          @click="recordLogin"
        />
        <UButton
          v-if="written"
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
    <p
      v-if="written"
      class="text-xs text-dimmed mt-2"
    >
      Última modificação: {{ updatedAt }}
    </p>

    <ScenarioWarnings
      :warnings="authWarnings"
      :slug="slug"
      class="mt-6"
    />

    <div
      v-if="authError || webdriver.error"
      class="mt-6 flex flex-col gap-3"
    >
      <UAlert
        color="error"
        variant="soft"
        data-testid="webdriver-erro"
        :description="authError ?? webdriver.error!"
      />
      <WebdriverSetup v-if="webdriver.error?.includes('Chrome')" />
    </div>

    <div
      v-if="!written"
      class="mt-8 flex flex-col items-center gap-3 py-10 text-center"
      data-testid="auth-intro"
    >
      <div class="flex size-12 items-center justify-center rounded-lg bg-elevated">
        <UIcon
          name="i-ic-round-lock"
          class="size-7 text-dimmed"
        />
      </div>
      <p class="font-semibold">
        Autenticação ainda não gravada
      </p>
      <p class="max-w-md text-sm text-muted">
        Vamos gravar o login de verdade: clique em "Gravar login" e entre normalmente na aba que abrir. A IA transforma essa gravação num teste de autenticação, sem adivinhar seletor e sem você digitar sua senha em formulário nenhum.
      </p>
      <p class="max-w-md text-xs text-dimmed">
        A senha digitada na gravação fica salva localmente no <code>.env</code> do projeto, nunca no script gerado nem versionada. Assim que o teste estiver escrito, ele é executado para confirmar que o login funciona.
      </p>
      <UButton
        label="Gravar login"
        trailing-icon="i-ic-round-fiber-manual-record"
        class="mt-2"
        :disabled="!webdriver.connected"
        data-testid="auth-gravar-vazio"
        @click="recordLogin"
      />
      <UButton
        v-if="project!.auth_status === 'unset'"
        label="Não precisa de login"
        color="neutral"
        variant="link"
        :loading="dismissingAuth"
        data-testid="auth-dispensar"
        @click="dismissAuth"
      />
    </div>

    <UTabs
      v-if="written"
      v-model="tab"
      :items="tabs"
      :content="false"
      class="w-full mt-8"
    >
      <template #default="{ item }">
        <span :data-testid="`cenario-tab-${item.value}`">{{ item.label }}</span>
      </template>
    </UTabs>

    <div
      v-if="written"
      class="mt-4"
    >
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
        <BaseCodefield
          :model-value="scenario!.gherkin!"
          language="gherkin"
          readonly
          testid="cenario-gherkin"
        />
      </template>

      <template v-else-if="tab === 'playwright'">
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

      <template v-else>
        <ScenarioTestRunHistory
          :runs="scenario!.runs"
          @open="openRun"
        />
      </template>
    </div>

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
      :passed="runPassed"
      :steps="steps"
      :video-url="videoUrl"
      :project-name="project!.name"
      :kind="isAuth ? 'autenticacao' : 'cenario'"
      :scenario-name="isAuth ? scenario!.spec : scenario!.title"
      :branch="project!.branch"
      :tested-at="testedAt"
      :playwright="executedPlaywright"
      :output="runOutput"
      @fix="requestFix"
    />

    <BaseModal
      v-model:open="writingAuth"
      :dismissable="false"
      loading
    >
      <template #body>
        <BaseLoadingPhrases
          :phrases="AUTH_PHRASES"
          data-testid="auth-carregando"
        />
      </template>
    </BaseModal>

    <ProjectAuthCredentials
      v-model:open="credentialsOpen"
      :slug="slug"
      @saved="runTest"
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
