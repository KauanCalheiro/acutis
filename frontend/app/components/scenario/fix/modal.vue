<script setup lang="ts">
interface FixedSpec {
  playwright: string
  summary: string
}

interface ScenarioFixModal {
  loading?: boolean
  fix?: FixedSpec | null
  error?: string | null
  applying?: boolean
}

const {
  loading = false,
  fix = null,
  error = null,
  applying = false
} = defineProps<ScenarioFixModal>()

const emit = defineEmits<{
  apply: []
  discard: []
}>()

const open = defineModel<boolean>('open', {
  default: false
})
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Correção proposta"
    :loading="loading"
    :dismissable="!loading && !applying"
    wide
  >
    <template #body>
      <BaseLoadingPhrases
        v-if="loading"
        :phrases="['Analisando a falha', 'Procurando um seletor melhor', 'Reescrevendo o teste']"
        data-testid="correcao-carregando"
      />

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-ic-round-error"
        title="Não foi possível gerar a correção"
        :description="error"
        data-testid="correcao-erro"
      />

      <div
        v-else-if="fix"
        data-testid="correcao-proposta"
      >
        <p
          class="mb-3 text-sm text-muted"
          data-testid="correcao-resumo"
        >
          {{ fix.summary }}
        </p>

        <BaseCodefield
          :model-value="fix.playwright"
          language="typescript"
          readonly
          testid="correcao-spec"
        />
      </div>
    </template>

    <template #footer>
      <UButton
        label="Descartar"
        color="neutral"
        variant="ghost"
        :disabled="applying"
        data-testid="correcao-descartar"
        @click="emit('discard')"
      />
      <UButton
        v-if="fix"
        label="Aplicar"
        icon="i-ic-round-check"
        :loading="applying"
        :disabled="applying"
        data-testid="correcao-aplicar"
        @click="emit('apply')"
      />
    </template>
  </BaseModal>
</template>
