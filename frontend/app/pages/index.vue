<script setup lang="ts">
import type { Project } from '~/types/project'

interface ProjectsResponse {
  data: Project[]
  meta: {
    current_page: number
    per_page: number
    total: number
  }
}

const PAGE_SIZE = 6

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

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
  'page[size]': PAGE_SIZE
}))

const { data, status, refresh } = await useFetch<ProjectsResponse>('/api/projects', {
  query
})

const projects = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.total ?? 0)

const createOpen = ref(false)

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
  'Bugs não se escondem de quem grava tudo',
]

const tagline = useState(
  'home-tagline',
  () => taglines[Math.floor(Math.random() * taglines.length)],
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

onMounted(typewriterLoop)
onBeforeUnmount(() => {
  typing = false
})
</script>

<template>
  <UContainer
    :data-hydrated="hydrated"
    class="py-6 lg:py-10"
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
      @saved="refresh()"
    />

    <div
      v-if="status === 'pending'"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <USkeleton
        v-for="i in PAGE_SIZE"
        :key="i"
        class="h-32"
      />
    </div>

    <p
      v-else-if="projects.length === 0"
      data-testid="projeto-vazio"
      class="text-muted py-10 text-center"
    >
      Nenhum projeto encontrado
    </p>

    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      <ProjectCard
        v-for="project in projects"
        :key="project.slug"
        :project="project"
      />
    </div>

    <div class="flex justify-center mt-8">
      <UPagination
        v-model:page="page"
        data-testid="projeto-paginacao"
        variant="soft"
        :total="total"
        :items-per-page="PAGE_SIZE"
      />
    </div>
  </UContainer>
</template>
