<script setup lang="ts">
import type { SelectorSuggestion } from '~/types/project'

// ponytail: rota de preview (ver .claude/memory/feedback_dev-preview-routes.md) —
// o modal é puramente apresentacional (loading/suggestions/error via prop),
// então cada botão só define o prop direto — sem chamada de API, sem "modo preview".
const loadingOpen = ref(false)
const errorOpen = ref(false)
const successOpen = ref(false)

const mockSuggestions: SelectorSuggestion[] = [
  {
    event: 'Entrar com usuário/código',
    currentSelector: '.btn-primary',
    suggestedTestId: 'login-entrar',
    reason: 'Classe CSS pode mudar com estilização.'
  },
  {
    event: 'Usuário ou código',
    currentSelector: '#user-input',
    suggestedTestId: 'login-usuario',
    reason: 'Id pode ser gerado dinamicamente pelo framework.'
  }
]
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-bold mb-1">
      Preview: Ver sugestões
    </h1>
    <p class="text-sm text-muted mb-8">
      Mesmo componente da tela de detalhe do cenário, com dado mocado — um botão por estado.
    </p>

    <div class="flex flex-wrap gap-3">
      <UButton
        label="Ver sugestões (loading)"
        trailing-icon="i-ic-round-auto-awesome"
        color="neutral"
        variant="soft"
        data-testid="preview-sugestoes-loading"
        @click="loadingOpen = true"
      />
      <UButton
        label="Ver sugestões (erro)"
        trailing-icon="i-ic-round-auto-awesome"
        color="neutral"
        variant="soft"
        data-testid="preview-sugestoes-erro"
        @click="errorOpen = true"
      />
      <UButton
        label="Ver sugestões (com dados)"
        trailing-icon="i-ic-round-auto-awesome"
        color="neutral"
        variant="soft"
        data-testid="preview-sugestoes-sucesso"
        @click="successOpen = true"
      />
    </div>

    <ScenarioSuggestionsModal
      v-model:open="loadingOpen"
      loading
    />
    <ScenarioSuggestionsModal
      v-model:open="errorOpen"
      error="Não foi possível gerar sugestões agora. Tente novamente."
    />
    <ScenarioSuggestionsModal
      v-model:open="successOpen"
      :suggestions="mockSuggestions"
    />
  </UContainer>
</template>
