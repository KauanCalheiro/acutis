<script setup lang="ts">
import type { Project } from '~/types/project'
import type { ProjectFormTab } from '#shared/schemas/project'

interface ProjectsResponse {
  data: Project[]
  meta: {
    current_page: number
    per_page: number
    total: number
  }
}

/** O que o SSR pede antes de medir a tela: três colunas por três linhas cabem na maioria. */
const DEFAULT_PAGE_SIZE = 9

const pageSize = ref(DEFAULT_PAGE_SIZE)
const viewport = ref<HTMLElement>()
const grid = ref<HTMLElement>()

const hydrated = ref(false)

const search = ref('')
const debouncedSearch = ref('')
const page = ref(1)

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedSearch.value = value
    page.value = 1
  }, 300)
})

const query = computed(() => ({
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  'page[number]': page.value,
  'page[size]': pageSize.value
}))

const { data, status } = await useFetch<ProjectsResponse>('/api/projects', {
  query
})

const projects = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.total ?? 0)

/**
 * Quantos cards cabem na tela. A grade fica com a altura que sobra do resto do conteúdo, e tudo é
 * medido do DOM: mudar o card, o gap ou as colunas do breakpoint não pede número novo aqui.
 */
function fitPageSize() {
  const gridEl = grid.value
  const block = viewport.value?.firstElementChild
  const card = gridEl?.firstElementChild

  if (!gridEl || !block || !card) {
    return
  }

  const style = getComputedStyle(gridEl)
  const gap = Number.parseFloat(style.rowGap) || 0
  const columns = style.gridTemplateColumns.split(' ').length
  const cardHeight = card.getBoundingClientRect().height
  const outside = block.getBoundingClientRect().height - gridEl.getBoundingClientRect().height
  const free = window.innerHeight - outside

  const rows = Math.max(1, Math.floor((free + gap) / (cardHeight + gap)))
  const fits = rows * columns

  if (fits === pageSize.value) {
    return
  }

  page.value = 1
  pageSize.value = fits
}

// A grade só existe depois da primeira resposta, e é dela que sai a medida do card.
watch(projects, () => nextTick(fitPageSize))

const createOpen = ref(false)
const createTab = ref<ProjectFormTab>('template')

function openCreate(tab: ProjectFormTab) {
  createTab.value = tab
  createOpen.value = true
}

const taglines = [
  'Testar na mão é coisa do passado',
  'Seu último deploy foi um ato de fé?',
  'Ou você acha os bugs, ou seus usuários acham',
  '"Funciona na minha máquina" não é teste',
  'Deploy sem teste é roleta-russa',
  'Sexta-feira, 17h. Confia no deploy?',
  'Quem não testa, testa em produção',
  'Seus usuários não são seu QA',
  'Coragem é dar deploy sem isso aqui',
  'Bugs não se escondem de quem grava tudo'
]

const tagline = useState(
  'home-tagline',
  () => taglines[Math.floor(Math.random() * taglines.length)]
)

const typed = ref(tagline.value ?? '')
let typing = true

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function typewriterLoop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  while (typing) {
    await sleep(6000)
    if (!typing) return

    const others = taglines.filter(phrase => phrase !== typed.value)
    const next = others[Math.floor(Math.random() * others.length)] ?? ''

    if (reduced) {
      typed.value = next
      continue
    }

    while (typing && typed.value.length > 0) {
      typed.value = typed.value.slice(0, -1)
      await sleep(25)
    }

    for (let i = 1; typing && i <= next.length; i++) {
      typed.value = next.slice(0, i)
      await sleep(55)
    }
  }
}

onMounted(() => {
  hydrated.value = true
  fitPageSize()
  window.addEventListener('resize', fitPageSize)
  typewriterLoop()
})

onBeforeUnmount(() => {
  typing = false
  window.removeEventListener('resize', fitPageSize)
})
</script>

<template>
  <!-- my-auto e não items-center: com conteúdo mais alto que a tela a margem automática zera, e a lista rola normal em vez de ter o topo cortado. -->
  <div
    ref="viewport"
    class="flex flex-col min-h-screen"
  >
    <UContainer
      :data-hydrated="hydrated"
      class="my-auto py-6 lg:py-10"
    >
      <h1
        class="text-3xl lg:text-4xl font-bold text-center mb-10"
        data-testid="projeto-frase"
      >
        {{ typed }}<span
          class="animate-pulse font-light text-muted"
          aria-hidden="true"
        >|</span>
      </h1>

      <div class="flex flex-wrap items-center gap-4 mb-8">
        <UInput
          v-model="search"
          data-testid="projeto-busca"
          icon="i-ic-round-search"
          placeholder="Buscar projeto..."
          class="flex-1 min-w-48"
        />
        <UButton
          data-testid="projeto-adicionar"
          label="Adicionar"
          trailing-icon="i-ic-round-add"
          @click="createOpen = true"
        />
      </div>

      <ProjectFormModal
        v-model:open="createOpen"
        v-model:tab="createTab"
      />

      <div
        v-if="status === 'pending'"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <USkeleton
          v-for="i in pageSize"
          :key="i"
          class="h-32"
        />
      </div>

      <ProjectEmpty
        v-else-if="projects.length === 0"
        @select="openCreate"
      />

      <div
        v-else
        ref="grid"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <ProjectCard
          v-for="project in projects"
          :key="project.slug"
          :project="project"
        />
      </div>

      <div
        v-if="projects.length > 0"
        class="flex justify-center mt-8"
      >
        <UPagination
          v-model:page="page"
          data-testid="projeto-paginacao"
          variant="soft"
          :total="total"
          :items-per-page="pageSize"
        />
      </div>
    </UContainer>
  </div>
</template>
