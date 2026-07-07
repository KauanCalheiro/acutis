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

const NOISE_CHARS = '!<>-_\\/[]{}—=+*^?#01'
const STEP_MS = 50
const HOLD_MS = 1200

const display = ref(phrases[0])

function noiseFor(char: string) {
  return char === ' ' ? ' ' : NOISE_CHARS[Math.floor(Math.random() * NOISE_CHARS.length)]
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function encrypt(text: string) {
  for (let locked = text.length; locked >= 0; locked--) {
    display.value = text.slice(0, locked) + text.slice(locked).split('').map(noiseFor).join('')
    await sleep(STEP_MS)
  }
}

async function decrypt(text: string) {
  for (let revealed = 0; revealed <= text.length; revealed++) {
    display.value = text.slice(0, revealed) + text.slice(revealed).split('').map(noiseFor).join('')
    await sleep(STEP_MS)
  }
}

let running = true

async function loop() {
  let index = 0
  while (running) {
    await sleep(HOLD_MS)
    if (!running) return
    const next = phrases[(index + 1) % phrases.length]!
    await encrypt(phrases[index]!)
    if (!running) return
    await decrypt(next)
    index = (index + 1) % phrases.length
  }
}

onMounted(() => {
  loop()
})

onUnmounted(() => {
  running = false
})
</script>

<template>
  <div
    data-testid="contexto-carregando"
    class="flex flex-col items-center gap-6 py-10 text-center"
  >
    <UIcon
      name="i-line-md-coffee-half-empty-twotone-loop"
      class="size-20 text-highlighted/75"
    />

    <p class="text-lg font-mono font-medium text-highlighted">
      {{ display }}
    </p>

    <p class="text-xs text-dimmed">
      Isso pode levar alguns segundos.
    </p>
  </div>
</template>
