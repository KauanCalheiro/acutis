<script setup lang="ts">
interface ScenarioWarnings {
  warnings?: string[]
  slug: string
}

const {
  warnings = [],
  slug
} = defineProps<ScenarioWarnings>()

const EMPTY_VAR = 'env-sem-valor'

/** O texto da ressalva, sem o slug da regra que o backend prefixa. */
const reasons = computed(() => warnings.map(warning => warning.replace(/^[a-z-]+: /, '')))

const fillable = computed(() => warnings.some(warning => warning.startsWith(EMPTY_VAR)))
</script>

<template>
  <UAlert
    v-if="warnings.length"
    color="warning"
    variant="soft"
    icon="i-ic-round-warning"
    title="A geração terminou com ressalvas"
    data-testid="geracao-ressalvas"
  >
    <template #description>
      <ul class="list-disc pl-4">
        <li
          v-for="reason in reasons"
          :key="reason"
        >
          {{ reason }}
        </li>
      </ul>

      <UButton
        v-if="fillable"
        label="Preencher ambiente"
        trailing-icon="i-ic-round-arrow-forward"
        color="warning"
        variant="link"
        class="mt-1 px-0"
        :to="`/projects/${slug}?environment`"
        data-testid="ressalvas-ambiente"
      />
    </template>
  </UAlert>
</template>
