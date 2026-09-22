<script setup lang="ts">
interface ScenarioEmpty {
  disabled?: boolean
  /** O projeto ainda não tem login gravado: é ele que vem antes de qualquer cenário autenticado. */
  needsLogin?: boolean
}

const { disabled = false, needsLogin = false } = defineProps<ScenarioEmpty>()

const emit = defineEmits<{
  record: []
  login: []
  skip: []
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
      {{ needsLogin
        ? 'Comece pelo login: é ele que abre o sistema para os cenários seguintes.'
        : 'Grave uma interação para gerar o primeiro teste.' }}
    </p>

    <BaseEmptyAction
      v-if="needsLogin"
      icon="i-ic-round-lock"
      title="Gravar o login"
      description="Abre o navegador para você entrar no sistema uma vez. A partir daí os cenários gravam já autenticados."
      testid="cenario-vazio-login"
      :disabled="disabled"
      @click="emit('login')"
    />

    <BaseEmptyAction
      v-else
      icon="i-ic-round-fiber-manual-record"
      title="Gravar cenário"
      description="Abre o navegador e grava sua interação pra virar um teste automático."
      testid="cenario-vazio-gravar"
      :disabled="disabled"
      @click="emit('record')"
    />

    <UButton
      v-if="needsLogin"
      label="Meu sistema não tem login"
      color="neutral"
      variant="link"
      class="mt-3"
      data-testid="cenario-vazio-sem-login"
      @click="emit('skip')"
    />
  </div>
</template>
