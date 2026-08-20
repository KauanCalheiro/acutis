<script setup lang="ts">
import type { Project } from '~/types/project'

interface ProjectCard {
  project: Project
}

const { project } = defineProps<ProjectCard>()

const origin = computed(() => projectOrigin(project))
</script>

<template>
  <NuxtLink :to="`/projects/${project.slug}`">
    <UCard
      data-testid="projeto-card"
      class="transition-colors hover:bg-accented/75"
    >
      <div class="flex flex-col gap-2">
        <p class="font-semibold truncate">
          {{ project.name }}
        </p>
        <p
          class="text-sm text-muted truncate"
          :title="project.repository ?? undefined"
        >
          {{ project.path }}
        </p>
        <UBadge
          :icon="origin.icon"
          :label="origin.label"
          class="self-start"
          data-testid="projeto-origem"
        />
      </div>
    </UCard>
  </NuxtLink>
</template>
