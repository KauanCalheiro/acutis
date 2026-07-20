<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { ProjectDetail, ScenarioDetail, SelectorSuggestion } from '~/types/project'

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

// ponytail: histórico de execuções ainda não é persistido no back-end (só a
// execução ao vivo existe) — mock até existir uma tabela de runs.
const mockRuns = [
  { date: '12/06/2026', status: 'success' },
  { date: '12/06/2026', status: 'success' },
  { date: '11/06/2026', status: 'failure' },
  { date: '11/06/2026', status: 'success' },
  { date: '10/06/2026', status: 'success' },
  { date: '10/06/2026', status: 'failure' }
] as const

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
          disabled
          data-testid="cenario-testar"
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

    <p class="font-semibold mt-10 mb-4">
      Testes
    </p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <UCard
        v-for="(run, i) in mockRuns"
        :key="i"
        data-testid="cenario-teste-card"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs text-muted">
              Testado em
            </p>
            <p class="text-sm font-semibold">
              {{ run.date }}
            </p>
          </div>
          <div class="flex items-center gap-2 w-25">
            <UIcon
              :name="run.status === 'success' ? 'i-ic-round-check-circle' : 'i-ic-round-error'"
              :class="{
                'bg-success': run.status === 'success',
                'bg-error': run.status === 'failure'
              }"
              class="size-6"
            />
            <span>
              {{ run.status === 'success' ? 'Sucesso' : 'Falha' }}
            </span>
          </div>
        </div>
      </UCard>
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
  </UContainer>
</template>
