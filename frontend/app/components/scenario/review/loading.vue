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

const index = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    index.value = (index.value + 1) % phrases.length
  }, 2500)
})

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div
    data-testid="contexto-carregando"
    class="flex flex-col items-center gap-6 py-10 text-center"
  >
    <span class="relative flex size-20 items-center justify-center">
      <span class="absolute inline-flex size-full animate-ping rounded-full bg-primary/30" />
      <span class="relative inline-flex size-20 items-center justify-center rounded-full bg-elevated">
        <UIcon
          name="i-ic-round-auto-awesome"
          class="size-9 animate-pulse text-primary"
        />
      </span>
    </span>

    <Transition
      mode="out-in"
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <p
        :key="index"
        class="text-lg font-medium text-highlighted"
      >
        {{ phrases[index] }}
      </p>
    </Transition>

    <p class="text-sm text-muted">
      Isso pode levar alguns segundos.
    </p>
  </div>
</template>
