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

const { data, status } = await useFetch<ProjectsResponse>('/api/projects', {
  query
})

const projects = computed(() => data.value?.data ?? [])
const total = computed(() => data.value?.meta.total ?? 0)
</script>

<template>
  <UContainer
    :data-hydrated="hydrated"
    class="py-6 lg:py-10"
  >
    <div class="flex flex-wrap items-center gap-4">
      <UInput
        v-model="search"
        data-testid="projeto-busca"
        icon="i-ic-round-search"
        placeholder="Buscar projeto..."
        size="lg"
        class="flex-1 min-w-48"
      />
      <UButton
        data-testid="projeto-adicionar"
        label="Adicionar"
        trailing-icon="i-ic-round-add"
        size="lg"
        disabled
      />
    </div>

    <h1 class="text-2xl font-bold mt-8 mb-4">
      Acesse seus projetos
    </h1>

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
        :total="total"
        :items-per-page="PAGE_SIZE"
      />
    </div>
  </UContainer>
</template>
