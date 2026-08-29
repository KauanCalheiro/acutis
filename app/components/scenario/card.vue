<script setup lang="ts">
import type { Scenario } from '~/types/project'
import { tagColor } from '~/utils/tags'

interface ScenarioCard {
  scenario: Scenario
  slug: string
}

const { scenario, slug } = defineProps<ScenarioCard>()

const emit = defineEmits<{
  run: []
  skip: []
  remove: []
}>()

/** O id do cenário é o caminho do spec sem `tests/` e sem a extensão. */
const id = computed(() => scenario.spec.replace(/^tests\//, '').replace(/\.spec\.ts$/, ''))

const page = computed(() => `/projects/${slug}/scenarios/${id.value}`)

const actions = computed(() => [
  [
    {
      label: 'Abrir o cenário',
      icon: 'i-ic-round-open-in-new',
      testid: 'cenario-menu-abrir',
      onSelect: () => navigateTo(page.value)
    },
    {
      label: 'Ver a última execução',
      icon: 'i-ic-round-history',
      testid: 'cenario-menu-execucao',
      onSelect: () => navigateTo(`${page.value}?tab=execucoes&run=ultima`)
    }
  ],
  [
    ...(scenario.skipped
      ? []
      : [{
          label: 'Rodar',
          icon: 'i-ic-round-play-arrow',
          testid: 'cenario-menu-rodar',
          onSelect: () => emit('run')
        }]),
    {
      label: scenario.skipped ? 'Voltar a rodar' : 'Pausar',
      icon: scenario.skipped ? 'i-ic-round-play-circle' : 'i-ic-round-pause-circle',
      testid: 'cenario-menu-pausar',
      onSelect: () => emit('skip')
    },
    {
      label: 'Editar',
      icon: 'i-ic-round-edit',
      testid: 'cenario-menu-editar',
      onSelect: () => navigateTo(`${page.value}?editar`)
    }
  ],
  [
    {
      label: 'Excluir',
      icon: 'i-ic-round-delete',
      color: 'error' as const,
      testid: 'cenario-menu-remover',
      onSelect: () => emit('remove')
    }
  ]
])
</script>

<template>
  <UContextMenu :items="actions">
    <UCard
      data-testid="cenario-card"
      class="cursor-pointer transition-colors hover:bg-accented/75"
      @click="navigateTo(page)"
    >
      <div class="flex flex-col gap-2">
        <p class="font-semibold truncate">
          {{ scenario.title }}
        </p>
        <p class="text-sm text-muted italic truncate">
          {{ scenario.spec }}
        </p>
        <div class="flex flex-wrap gap-1">
          <UBadge
            v-if="scenario.skipped"
            color="warning"
            variant="soft"
            size="md"
            icon="i-ic-round-pause-circle"
            label="Pausado"
            data-testid="cenario-card-pulado"
          />
          <UBadge
            v-for="tag in scenario.tags"
            :key="tag"
            :color="tagColor(tag)"
            size="md"
            :label="tag"
          />
        </div>
      </div>
    </UCard>

    <template #item-label="{ item }">
      <span :data-testid="item.testid">{{ item.label }}</span>
    </template>
  </UContextMenu>
</template>
