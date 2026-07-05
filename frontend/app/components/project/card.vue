<script setup lang="ts">
import type { Project } from '~/types/project'

interface ProjectCard {
  project: Project
}

const { project } = defineProps<ProjectCard>()

const providers = {
  github: {
    label: 'GitHub',
    icon: 'i-simple-icons-github'
  },
  gitlab: {
    label: 'GitLab',
    icon: 'i-simple-icons-gitlab'
  }
} as const

const provider = computed(() => (project.provider ? providers[project.provider] : null))
</script>

<template>
  <UCard data-testid="projeto-card">
    <div class="flex flex-col gap-2">
      <p class="font-semibold truncate">
        {{ project.name }}
      </p>
      <p class="text-sm text-muted truncate">
        {{ project.repository ?? project.path }}
      </p>
      <UBadge
        v-if="provider"
        color="neutral"
        variant="outline"
        :icon="provider.icon"
        :label="provider.label"
        class="self-start"
      />
    </div>
  </UCard>
</template>
