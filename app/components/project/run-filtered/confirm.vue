<script setup lang="ts">
interface ProjectRunFilteredConfirm {
  count: number
  /** Texto da busca que decidiu quais cenários entraram na execução. */
  filter?: string
}

const { count, filter = '' } = defineProps<ProjectRunFilteredConfirm>()

const open = defineModel<boolean>('open', {
  default: false
})

const emit = defineEmits<{
  confirm: []
}>()

const plural = computed(() => count === 1 ? '' : 's')

const scenarios = computed(() => `${count} cenário${plural.value}`)

const target = computed(() => filter
  ? `${scenarios.value} filtrado${plural.value} por "${filter}"`
  : `${scenarios.value} do projeto`)

const description = computed(() => `Isso abre o navegador e roda ${target.value}, do começo.`)

function confirm() {
  open.value = false
  emit('confirm')
}
</script>

<template>
  <BaseConfirm
    v-model:open="open"
    :title="`Rodar ${scenarios}`"
    :description="description"
    confirm-label="Rodar"
    confirm-testid="projeto-rodar-confirmar"
    @confirm="confirm"
  />
</template>
