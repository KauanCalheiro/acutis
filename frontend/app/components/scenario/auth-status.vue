<script setup lang="ts">
interface ScenarioAuthStatus {
  status: string
}

const { status } = defineProps<ScenarioAuthStatus>()

/** Null em `unset`: aí quem conta o estado é o convite a gravar, e o badge só repetiria. */
const badge = computed(() => ({
  configured: {
    label: 'Configurada',
    icon: 'i-ic-round-lock',
    color: 'success' as const
  },
  failing: {
    label: 'Falhando',
    icon: 'i-ic-round-error',
    color: 'error' as const
  },
  skipped: {
    label: 'Dispensada',
    icon: 'i-ic-round-lock-open',
    color: 'neutral' as const
  }
}[status] ?? null))
</script>

<template>
  <UBadge
    v-if="badge"
    variant="soft"
    :icon="badge.icon"
    :color="badge.color"
    :label="badge.label"
    data-testid="cenario-auth-status"
  />
</template>
