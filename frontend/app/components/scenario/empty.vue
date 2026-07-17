<script setup lang="ts">
interface ScenarioEmpty {
  disabled?: boolean
}

const { disabled = false } = defineProps<ScenarioEmpty>()

const emit = defineEmits<{
  record: []
}>()
</script>

<template>
  <div
    data-testid="cenario-vazio"
    class="py-10 text-center"
  >
    <p class="text-xl font-semibold">
      Nenhum cenário ainda
    </p>
    <p class="text-muted mb-6">
      Grave uma interação para gerar o primeiro teste.
    </p>

    <UCard
      data-testid="cenario-vazio-gravar"
      class="max-w-sm mx-auto transition-colors"
      :class="disabled ? 'opacity-50' : 'cursor-pointer hover:bg-accented/75'"
      @click="!disabled && emit('record')"
    >
      <div class="flex flex-col items-center gap-2">
        <div class="flex size-15 items-center justify-center rounded-lg bg-primary/10">
          <UIcon
            name="i-ic-round-fiber-manual-record"
            class="size-10 text-primary"
          />
        </div>
        <p class="text-lg font-semibold">
          Gravar cenário
        </p>
        <p class="text-sm text-muted">
          Abre o navegador e grava sua interação pra virar um teste automático.
        </p>
      </div>
    </UCard>
  </div>
</template>
