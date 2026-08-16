<script setup lang="ts">
import type { ProjectDetail } from '~/types/project'

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

const filteredRun = useRunStream(() => slug.value)
const filteredRunOpen = ref(false)

/** O que roda é o que está na tela: os títulos filtrados viram o `--grep` do Playwright. */
function runFiltered() {
  filteredRunOpen.value = true
  filteredRun.start({
    grep: scenarios.value.map(scenario => scenario.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  })
}

const settingsOpen = ref(false)

/** O modal de configurações abre sozinho no projeto que ainda não tem URL base. */
onMounted(() => {
  if (project.value?.requires_url) settingsOpen.value = true
})

const environmentsOpen = ref(false)

/** `?ambiente` abre o modal, que é para onde a ressalva de variável sem valor aponta. */
onMounted(() => {
  if (useRoute().query.ambiente !== undefined) environmentsOpen.value = true
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

function recordPlain() {
  recordingMode.value = 'plain'
  startRecording('scenario', { url: projectUrl.value })
}

function recordPublic() {
  recordingMode.value = 'public'
  startRecording('scenario', { url: projectUrl.value })
}

/** Roda o auth.setup.ts antes de abrir o navegador; falhou o login, não abre. */
function recordAuthenticated() {
  recordingMode.value = 'authenticated'
  authRunOpen.value = true
  authRun.start({ spec: AUTH_SPEC }, () => {
    refresh()

    if (!authRun.passed.value) return

    authRunOpen.value = false
    startRecording('scenario', {
      storageState: project.value!.storage_state,
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

watch(() => webdriver.value.videoSessionId, (sessionId) => {
  if (!sessionId) return

  reviewOpen.value = true
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
          label="Relatório da última execução"
          color="neutral"
          variant="soft"
          :to="reportUrlFor(slug)"
          target="_blank"
          external
          data-testid="projeto-relatorio"
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
        :label="`Rodar ${scenarios.length} filtrados`"
        trailing-icon="i-ic-round-play-arrow"
        color="neutral"
        variant="soft"
        :disabled="!scenarios.length"
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
      :scenario-name="AUTH_SPEC"
      :branch="project!.branch"
      :tested-at="authRun.testedAt.value"
      :output="authRun.output.value"
      @fix="navigateTo(authPage)"
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
