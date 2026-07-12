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

function tagColor(tag: string) {
  if (tag === '@read') return 'success'
  if (tag === '@write') return 'warning'
  return 'primary'
}

const renameOpen = ref(false)
const removeOpen = ref(false)
const removing = ref(false)
const authOpen = ref(false)
const authRecording = ref(false)
const authModal = ref<{ submitRecording: (baseUrl: string, events: RecorderEvent[]) => Promise<void> } | null>(null)
const skippingAuth = ref(false)

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

function startAuthRecording() {
  authRecording.value = true
  startRecording()
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
        <BaseButtonIcon
          icon="i-ic-round-key"
          label="Autenticação"
          :color="project!.auth_status === 'configured' ? 'success' : 'neutral'"
          variant="soft"
          data-testid="projeto-auth"
          @click="authOpen = true"
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

    <div class="flex flex-wrap items-center gap-4 mt-8 mb-8">
      <UInput
        v-model="search"
        data-testid="cenario-busca"
        icon="i-ic-round-search"
        placeholder="Buscar cenário..."
        class="flex-1 min-w-48"
      />
      <UButton
        v-if="!webdriver.recording"
        data-testid="cenario-novo"
        label="Novo cenário"
        trailing-icon="i-ic-round-add"
        :disabled="!webdriver.connected"
        @click="startRecording"
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
      @generated="refresh()"
      @rerecord="startRecording"
    />

    <div
      v-if="scenarios.length"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <UCard
        v-for="scenario in scenarios"
        :key="scenario.spec"
        data-testid="cenario-card"
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

    <p
      v-else
      class="text-muted text-center py-12"
      data-testid="cenario-vazio"
    >
      Nenhum cenário ainda. Grave uma interação para gerar o primeiro teste.
    </p>

    <ProjectRenameModal
      v-model:open="renameOpen"
      :slug="project!.slug"
      :name="project!.name"
      @renamed="onRenamed"
    />

    <ProjectAuthModal
      ref="authModal"
      v-model:open="authOpen"
      :slug="slug"
      :status="project!.auth_status"
      @configured="refresh()"
      @record="startAuthRecording"
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
