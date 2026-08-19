<script setup lang="ts">
const phrases = [
  'Analisando os elementos da tela',
  'Identificando os fluxos de navegação',
  'Interpretando suas interações',
  'Gerando os contextos do cenário',
  'Escrevendo os passos em Gherkin',
  'Traduzindo para o teste Playwright',
  'Dando os retoques finais'
]
</script>

<template>
  <BaseLoadingPhrases
    :phrases="phrases"
    data-testid="contexto-carregando"
  />
</template>
