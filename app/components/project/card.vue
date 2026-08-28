<script setup lang="ts">
import type { Project } from '~/types/project'

interface ProjectCard {
  project: Project
}

const { project } = defineProps<ProjectCard>()

const emit = defineEmits<{
  removed: []
}>()

const origin = computed(() => projectOrigin(project))

const notify = useNotify()

const removeOpen = ref(false)
const removing = ref(false)

const actions = computed(() => [
  [
    {
      label: 'Acessar',
      icon: 'i-ic-round-open-in-new',
      testid: 'projeto-menu-acessar',
      onSelect: () => navigateTo(`/projects/${project.slug}`)
    },
    {
      label: 'Gravar cenário público',
      icon: 'i-ic-round-public',
      testid: 'projeto-menu-gravar-publico',
      onSelect: () => navigateTo(`/projects/${project.slug}?gravar=publico`)
    },
    {
      label: 'Gravar cenário autenticado',
      icon: 'i-ic-round-lock',
      testid: 'projeto-menu-gravar-autenticado',
      onSelect: () => navigateTo(`/projects/${project.slug}?gravar=autenticado`)
    }
  ],
  [
    {
      label: 'Abrir no VS Code',
      icon: 'i-simple-icons-visualstudiocode',
      testid: 'projeto-menu-vscode',
      to: `vscode://file${project.path}`,
      target: '_blank'
    },
    {
      label: 'Copiar caminho',
      icon: 'i-ic-round-content-copy',
      testid: 'projeto-menu-copiar',
      onSelect: () => copyPath()
    }
  ],
  [
    {
      label: 'Remover',
      icon: 'i-ic-round-delete',
      color: 'error' as const,
      testid: 'projeto-menu-remover',
      onSelect: () => {
        removeOpen.value = true
      }
    }
  ]
])

async function copyPath() {
  await navigator.clipboard.writeText(project.path)
  notify.success('Caminho copiado.')
}

async function remove() {
  removing.value = true

  try {
    await $fetch(`/api/projects/${project.slug}`, {
      method: 'DELETE'
    })
    removeOpen.value = false
    emit('removed')
  } catch (error) {
    notify.failure(error, 'Não foi possível remover o projeto.')
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UContextMenu :items="actions">
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

    <template #item-label="{ item }">
      <span :data-testid="item.testid">{{ item.label }}</span>
    </template>
  </UContextMenu>

  <BaseConfirm
    v-model:open="removeOpen"
    title="Remover projeto"
    :description="`Isso apaga a pasta ${project.path} e todos os testes dentro dela.`"
    confirm-label="Remover"
    confirm-color="error"
    confirm-testid="projeto-remover-confirmar"
    :loading="removing"
    @confirm="remove"
  />
</template>
