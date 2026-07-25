<script setup lang="ts">
import type { ProjectFormTab } from '#shared/schemas/project'

const emit = defineEmits<{
  select: [tab: ProjectFormTab]
}>()
</script>

<template>
  <div
    data-testid="projeto-vazio"
    class="py-10 text-center"
  >
    <p class="text-xl font-semibold">
      Nenhum projeto por aqui ainda
    </p>
    <p class="text-muted mb-6">
      Escolha como começar:
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left">
      <UCard
        data-testid="projeto-vazio-template"
        class="cursor-pointer transition-colors hover:bg-accented/75"
        @click="emit('select', 'template')"
      >
        <div class="flex flex-col gap-2">
          <div class="flex size-15 items-center justify-center rounded-lg bg-primary/10 mx-auto">
            <UIcon
              name="i-ic-round-add"
              class="size-10 text-primary"
            />
          </div>
          <p class="text-lg font-semibold text-center">
            Começar do zero
          </p>
          <p class="text-sm text-muted">
            Cria um projeto vazio, só com um nome. Você grava os cenários depois.
          </p>
        </div>
      </UCard>

      <UCard
        data-testid="projeto-vazio-git"
        class="cursor-pointer transition-colors hover:bg-accented/75"
        @click="emit('select', 'git')"
      >
        <div class="flex flex-col gap-2">
          <div class="flex size-15 items-center justify-center rounded-lg bg-primary/10 mx-auto">
            <UIcon
              name="i-ic-round-cloud-download"
              class="size-10 text-primary"
            />
          </div>
          <p class="text-lg font-semibold text-center">
            Importar de um Git
          </p>
          <p class="text-sm text-muted">
            Clona um repositório existente (público, com token ou SSH) e já traz o histórico.
          </p>
        </div>
      </UCard>
    </div>
  </div>
</template>
