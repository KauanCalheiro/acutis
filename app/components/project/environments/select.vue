<script setup lang="ts">
import type { EnvironmentList } from '~/types/project'

interface ProjectEnvironmentsSelect {
  slug: string
}

const { slug } = defineProps<ProjectEnvironmentsSelect>()

const emit = defineEmits<{
  edit: []
  activated: []
}>()

const { data, refresh } = await useFetch<EnvironmentList>(`/api/projects/${slug}/environments`, {
  key: `environments-${slug}`
})

const switching = ref(false)

const items = computed(() => (data.value?.environments ?? []).map(environment => ({
  label: environment.name,
  value: environment.slug
})))

const active = computed({
  get: () => data.value?.active ?? undefined,
  set: activate
})

async function activate(environment?: string) {
  if (!environment || environment === data.value?.active) return

  switching.value = true

  try {
    await $fetch(`/api/projects/${slug}/environments/${environment}/activate`, { method: 'POST' })
    await refresh()
    emit('activated')
  } finally {
    switching.value = false
  }
}
</script>

<template>
  <UTooltip
    v-if="items.length < 2"
    text="Editar as variáveis deste ambiente"
  >
    <UButton
      icon="i-ic-round-layers"
      :label="items[0]?.label ?? 'Ambientes'"
      color="neutral"
      variant="soft"
      data-testid="projeto-ambientes"
      @click="emit('edit')"
    />
  </UTooltip>

  <UFieldGroup v-else>
    <USelectMenu
      v-model="active"
      :items="items"
      value-key="value"
      :search-input="false"
      :loading="switching"
      icon="i-ic-round-layers"
      class="w-44"
      data-testid="projeto-ambiente-ativo"
    >
      <template #item-label="{ item }">
        <span :data-testid="`projeto-ambiente-${item.value}`">{{ item.label }}</span>
      </template>
    </USelectMenu>

    <BaseButtonIcon
      icon="i-ic-round-tune"
      label="Editar ambientes"
      color="neutral"
      variant="soft"
      data-testid="projeto-ambientes"
      @click="emit('edit')"
    />
  </UFieldGroup>
</template>
