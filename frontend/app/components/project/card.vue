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

const origin = computed(() => {
  if (project.provider) return providers[project.provider]
  if (project.repository) {
    return {
      label: 'Git',
      icon: 'i-simple-icons-git'
    }
  }
  return {
    label: 'Local',
    icon: 'i-ic-round-computer'
  }
})
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
        :icon="origin.icon"
        :label="origin.label"
        class="self-start"
        data-testid="projeto-origem"
      />
    </div>
  </UCard>
</template>
