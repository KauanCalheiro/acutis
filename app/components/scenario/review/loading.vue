<script setup lang="ts">
interface ScenarioReviewLoading {
  auth?: boolean
}

const { auth = false } = defineProps<ScenarioReviewLoading>()

const SCENARIO_PHRASES = [
  'Analisando os elementos da tela',
  'Identificando os fluxos de navegação',
  'Interpretando suas interações',
  'Gerando os contextos do cenário',
  'Escrevendo os passos em Gherkin',
  'Traduzindo para o teste Playwright',
  'Dando os retoques finais'
]

const AUTH_PHRASES = [
  'Analisando os eventos gravados',
  'Identificando os campos de usuário e senha',
  'Escrevendo o fluxo de autenticação'
]
</script>

<template>
  <BaseLoadingPhrases
    :phrases="auth ? AUTH_PHRASES : SCENARIO_PHRASES"
    :data-testid="auth ? 'auth-carregando' : 'contexto-carregando'"
  />
</template>
