<script setup lang="ts">
const phrases = [
  'Analisando os eventos gravados',
  'Procurando seletores frágeis',
  'Pensando em nomes de data-testid',
  'Preparando as sugestões'
]
</script>

<template>
  <BaseLoadingPhrases
    :phrases="phrases"
    data-testid="sugestoes-carregando"
  />
</template>
