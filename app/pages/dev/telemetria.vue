<script setup lang="ts">
import { DEFAULT_TELEMETRY_URL } from '@acutis/core/config/telemetry-endpoint'

definePageMeta({
  middleware: () => {
    if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Página só de desenvolvimento' })
  }
})

const notify = useNotify()
const enviando = ref(false)

async function provocarErro() {
  enviando.value = true

  try {
    await $fetch('/debug/erro-de-telemetria')
  } catch (error) {
    notify.failure(error, 'Não foi possível gerar o cenário. Este é um erro de teste.', 'Página de dev da telemetria')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <UContainer class="py-12 space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold">
        Telemetria de erro
      </h1>
      <p class="text-(--ui-text-muted)">
        O botão provoca uma falha real na API. A toast que aparece é a mesma que qualquer pessoa vê,
        com a ação de enviar os logs.
      </p>
    </div>

    <UButton
      :loading="enviando"
      color="error"
      icon="i-ic-round-error"
      @click="provocarErro"
    >
      Provocar erro
    </UButton>

    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-ic-round-cloud-upload"
      title="Para onde o relato vai"
      :description="DEFAULT_TELEMETRY_URL || 'nenhum servidor configurado, o botão de envio não aparece'"
    />
  </UContainer>
</template>
