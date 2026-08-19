<script setup lang="ts">
import type { ScenarioRun } from '~/types/project'

interface ScenarioTestRunHistory {
  runs?: ScenarioRun[]
}

const { runs = [] } = defineProps<ScenarioTestRunHistory>()

const emit = defineEmits<{
  open: [run: ScenarioRun]
}>()

const PAGE_SIZE = 6

const statusItems = [
  {
    label: 'Todos',
    value: 'todos'
  },
  {
    label: 'Sucesso',
    value: 'sucesso'
  },
  {
    label: 'Falha',
    value: 'falha'
  }
]

const search = ref('')
const status = ref('todos')
const page = ref(1)

function testedAt(run: ScenarioRun) {
  return new Date(run.started_at).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

function took(run: ScenarioRun) {
  const seconds = (run.duration_ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

  return `${seconds}s`
}

/** O que a busca varre numa execução: data, branch, autor e o título do step que falhou. */
function searchable(run: ScenarioRun) {
  return [
    testedAt(run),
    run.branch,
    run.author,
    ...run.steps.filter(step => step.status === 'failed').map(step => step.title)
  ].join(' ').toLowerCase()
}

const filtered = computed(() => runs.filter((run) => {
  const matchesStatus = status.value === 'todos' || (status.value === 'sucesso') === run.passed

  return matchesStatus && searchable(run).includes(search.value.trim().toLowerCase())
}))

const paginated = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

watch([search, status], () => {
  page.value = 1
})
</script>

<template>
  <!-- Sem título próprio: quem nomeia a seção é a aba "Execuções" que a abre. -->
  <section>
    <BaseEmpty
      v-if="runs.length === 0"
      icon="i-ic-round-play-circle-outline"
      title="Nenhum teste executado ainda"
      description="Rode o cenário em Testar. Cada execução fica registrada aqui com o resultado e o código que rodou."
      testid="cenario-execucoes-vazio"
    />

    <template v-else>
      <div class="mb-3 flex flex-col gap-2 sm:flex-row">
        <UInput
          v-model="search"
          icon="i-ic-round-search"
          placeholder="Buscar por data, branch, autor ou step que falhou"
          class="flex-1"
          data-testid="execucoes-busca"
        />

        <USelect
          v-model="status"
          :items="statusItems"
          class="sm:w-40"
          data-testid="execucoes-status"
        />
      </div>

      <BaseEmpty
        v-if="filtered.length === 0"
        icon="i-ic-round-search-off"
        title="Nenhuma execução encontrada"
        description="Nada no histórico casa com a busca e o status escolhidos. Limpe os filtros para ver as execuções de novo."
        testid="cenario-execucoes-sem-resultado"
      />

      <div
        v-else
        class="grid gap-3 sm:grid-cols-2"
      >
        <UCard
          v-for="run in paginated"
          :key="run.started_at"
          class="cursor-pointer transition-colors hover:bg-accented/75"
          data-testid="cenario-execucao"
          :data-status="run.passed ? 'success' : 'failed'"
          @click="emit('open', run)"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm text-muted">
                Testado em
              </p>
              <p class="truncate">
                {{ testedAt(run) }}
                <span class="text-muted">em {{ took(run) }}</span>
              </p>
            </div>

            <UBadge
              variant="soft"
              :color="run.passed ? 'success' : 'error'"
              :icon="run.passed ? 'i-ic-round-check-circle' : 'i-ic-round-error'"
              :label="run.passed ? 'Sucesso' : 'Falha'"
            />
          </div>
        </UCard>
      </div>

      <div
        v-if="filtered.length > PAGE_SIZE"
        class="mt-4 flex justify-center"
      >
        <UPagination
          v-model:page="page"
          variant="soft"
          :total="filtered.length"
          :items-per-page="PAGE_SIZE"
          data-testid="execucoes-paginacao"
        />
      </div>
    </template>
  </section>
</template>
