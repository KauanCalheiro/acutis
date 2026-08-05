<script setup lang="ts">
import type { ProjectDetail } from '~/types/project'
import type { RecorderEvent } from '~/composables/webdriver'

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

const renameOpen = ref(false)
const settingsOpen = ref(false)

onMounted(() => {
  if (project.value?.requires_url) settingsOpen.value = true
})
const environmentsOpen = ref(false)

async function onEnvironmentsSaved() {
  await refreshNuxtData(`environments-${slug.value}`)
  await refresh()
}
const removeOpen = ref(false)
const removing = ref(false)
const authOpen = ref(false)
const authRecording = ref(false)
const authModal = ref<{ submitRecording: (baseUrl: string, events: RecorderEvent[]) => Promise<void> } | null>(null)
const skippingAuth = ref(false)

const AUTH_SPEC = 'tests/auth.setup.ts'

const authRun = useRunStream(() => slug.value)
const authRunOpen = ref(false)

const authButtonColor = computed(() => ({
  configured: 'success',
  failing: 'error',
  unset: 'neutral',
  skipped: 'neutral'
}[project.value!.auth_status] as 'success' | 'error' | 'neutral'))

/** O setup de auth é executado pelo mesmo streaming dos cenários, e é a execução que define o status. */
function runAuthSetup() {
  authRunOpen.value = true
  authFix.value = null
  authFixError.value = null
  authRun.start(AUTH_SPEC, refresh)
}

const authFixOpen = ref(false)
const authFixing = ref(false)
const authFix = ref<{ playwright: string, summary: string } | null>(null)
const authFixError = ref<string | null>(null)
const applyingAuthFix = ref(false)

async function requestAuthFix() {
  const failed = authRun.failedStep.value
  if (!failed) return

  authRunOpen.value = false
  authFixOpen.value = true
  authFixing.value = true
  authFix.value = null
  authFixError.value = null

  try {
    authFix.value = await $fetch<{ playwright: string, summary: string }>(`/api/projects/${slug.value}/scenario-fix`, {
      method: 'POST',
      body: { scenarioId: 'auth', step: failed.title, error: failed.error ?? '' }
    })
  } catch (error) {
    authFixError.value = extractServerError(error, 'Não foi possível gerar uma correção agora. Tente novamente.')
  } finally {
    authFixing.value = false
  }
}

async function applyAuthFix() {
  if (!authFix.value) return

  applyingAuthFix.value = true

  try {
    await $fetch(`/api/projects/${slug.value}/auth`, {
      method: 'PUT',
      body: { authSetup: authFix.value.playwright }
    })

    authFix.value = null
    authFixOpen.value = false
    runAuthSetup()
  } catch (error) {
    authFixError.value = extractServerError(error, 'Não foi possível salvar a correção.')
  } finally {
    applyingAuthFix.value = false
  }
}

function discardAuthFix() {
  authFixOpen.value = false
  authFix.value = null
  authFixError.value = null
}

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

/**
 * `publico` marca o cenário com @publico e o faz rodar fora da sessão, e a tela de login é o caso
 * óbvio. `simples` é o projeto sem autenticação: não carimba nada, porque se auth for configurada
 * depois esses cenários vão precisar da sessão.
 */
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

function recordPlain() {
  recordingMode.value = 'plain'
  startRecording('scenario', { url: projectUrl.value })
}

function recordPublic() {
  recordingMode.value = 'public'
  startRecording('scenario', { url: projectUrl.value })
}

/**
 * Roda o auth.setup.ts antes de abrir o navegador: a sessão injetada sempre nasce válida, sem
 * heurística de expiração. Falhou o login, nem abre, e o resultado aparece no mesmo modal de sempre.
 */
function recordAuthenticated() {
  recordingMode.value = 'authenticated'
  authRunOpen.value = true
  authRun.start(AUTH_SPEC, () => {
    refresh()

    if (!authRun.passed.value) return

    authRunOpen.value = false
    startRecording('scenario', {
      storageState: `${project.value!.path}/storage-state.json`,
      url: projectUrl.value
    })
  })
}

/** Atalho de um clique (card de estado vazio): num projeto com login, autenticado é o caso comum. */
function recordDefault() {
  return hasAuth.value ? recordAuthenticated() : recordPlain()
}

/** Regravar mantém o tipo escolhido, porque trocar de autenticado pra público no meio seria surpresa. */
function recordAgain() {
  if (recordingMode.value === 'authenticated') return recordAuthenticated()
  if (recordingMode.value === 'public') return recordPublic()

  recordPlain()
}

function eventsBaseUrl(events: RecorderEvent[]): string | null {
  const first = events.find(event => event.url)
  if (!first?.url) return null
  try {
    return new URL(first.url).origin
  } catch {
    return null
  }
}

watch(() => webdriver.value.videoSessionId, async (sessionId) => {
  if (!sessionId) return

  if (authRecording.value) {
    authRecording.value = false
    const baseUrl = eventsBaseUrl(webdriver.value.events)
    if (baseUrl) await authModal.value?.submitRecording(baseUrl, webdriver.value.events)
    return
  }

  reviewOpen.value = true
})

function stopAndReview() {
  stopRecording()
}

/** Regravar o login abre no sistema, mas sem sessão, porque é justamente o login que vamos capturar. */
function startAuthRecording() {
  authRecording.value = true
  startRecording('auth', { url: projectUrl.value })
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
        <h1
          class="text-3xl font-bold truncate"
          data-testid="projeto-nome"
        >
          {{ project!.name }}
        </h1>
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
          icon="i-ic-round-code"
          label="Abrir no VS Code"
          color="neutral"
          variant="soft"
          :to="project!.vscode_url"
          target="_blank"
          data-testid="projeto-vscode"
        />
        <BaseButtonIcon
          icon="i-ic-round-key"
          label="Autenticação"
          :color="authButtonColor"
          variant="soft"
          data-testid="projeto-auth"
          @click="authOpen = true"
        />
        <BaseButtonIcon
          icon="i-ic-round-settings"
          label="Configurações"
          color="neutral"
          variant="soft"
          data-testid="projeto-configuracoes"
          @click="settingsOpen = true"
        />
        <BaseButtonIcon
          icon="i-ic-round-edit"
          label="Renomear projeto"
          color="neutral"
          variant="soft"
          data-testid="projeto-editar"
          @click="renameOpen = true"
        />
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
          data-testid="projeto-auth-configurar"
          @click="authOpen = true"
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
          label="Executar de novo"
          size="md"
          color="neutral"
          variant="link"
          data-testid="projeto-auth-reexecutar"
          @click="runAuthSetup"
        />
        <UButton
          label="Ver autenticação"
          size="md"
          color="error"
          data-testid="projeto-auth-revisar"
          @click="authOpen = true"
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
        @click="recordPlain"
      />
      <UButton
        v-else
        data-testid="cenario-parar"
        label="Parar gravação"
        trailing-icon="i-ic-round-stop"
        color="error"
        class="animate-pulse"
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
      :publico="recordingPublic"
      @generated="refresh()"
      @rerecord="recordAgain"
    />

    <div
      v-if="scenarios.length"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <UCard
        v-for="scenario in scenarios"
        :key="scenario.spec"
        data-testid="cenario-card"
        class="cursor-pointer"
        @click="navigateTo(`/projects/${slug}/scenarios/${scenario.spec.replace(/^tests\//, '').replace(/\.spec\.ts$/, '')}`)"
      >
        <div class="flex flex-col gap-2">
          <p class="font-semibold truncate">
            {{ scenario.title }}
          </p>
          <p class="text-sm text-muted italic truncate">
            {{ scenario.spec }}
          </p>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="tag in scenario.tags"
              :key="tag"
              :color="tagColor(tag)"
              size="md"
              :label="tag"
            />
          </div>
        </div>
      </UCard>
    </div>

    <ScenarioEmpty
      v-else
      :disabled="!webdriver.connected"
      @record="recordDefault"
    />

    <ProjectRenameModal
      v-model:open="renameOpen"
      :slug="project!.slug"
      :name="project!.name"
      @renamed="onRenamed"
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
      :required="project!.requires_url"
      @saved="refresh()"
    />

    <ProjectAuthModal
      ref="authModal"
      v-model:open="authOpen"
      :slug="slug"
      :status="project!.auth_status"
      @written="runAuthSetup"
      @test="runAuthSetup"
      @record="startAuthRecording"
    />

    <ScenarioTestRunModal
      v-model:open="authRunOpen"
      :running="authRun.running.value"
      :live="authRun.live.value"
      :passed="authRun.passed.value"
      :steps="authRun.steps.value"
      :video-url="authRun.videoUrl.value"
      :project-name="project!.name"
      kind="autenticacao"
      :scenario-name="AUTH_SPEC"
      :branch="project!.branch"
      :tested-at="authRun.testedAt.value"
      :output="authRun.output.value"
      @fix="requestAuthFix"
    />

    <ScenarioFixModal
      v-model:open="authFixOpen"
      :loading="authFixing"
      :fix="authFix"
      :error="authFixError"
      :applying="applyingAuthFix"
      @apply="applyAuthFix"
      @discard="discardAuthFix"
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
