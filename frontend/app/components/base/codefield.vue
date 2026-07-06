<script setup lang="ts">
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-gherkin'
import 'prismjs/themes/prism-tomorrow.css'

interface BaseCodefield {
  language: 'typescript' | 'gherkin'
  testid?: string
}

const { language, testid } = defineProps<BaseCodefield>()

const model = defineModel<string>({
  default: ''
})

const textarea = ref<HTMLTextAreaElement | null>(null)

const highlighted = computed(() =>
  // ponytail: v-html do próprio rascunho do usuário; Prism.highlight escapa entidades
  Prism.highlight(model.value, Prism.languages[language]!, language) + '\n',
)

function resize() {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onTab(event: KeyboardEvent) {
  const el = textarea.value
  if (!el) return
  event.preventDefault()
  const { selectionStart: start, selectionEnd: end } = el
  model.value = `${model.value.slice(0, start)}  ${model.value.slice(end)}`
  nextTick(() => el.setSelectionRange(start + 2, start + 2))
}

watch(model, () => nextTick(resize))
onMounted(resize)
</script>

<template>
  <div class="codefield relative overflow-hidden rounded-md bg-[#2d2d2d] font-mono text-sm/6">
    <pre
      aria-hidden="true"
      class="codefield-box pointer-events-none absolute inset-0 m-0 overflow-hidden"
    ><code v-html="highlighted" /></pre>
    <textarea
      ref="textarea"
      v-model="model"
      :data-testid="testid"
      spellcheck="false"
      class="codefield-box relative block w-full resize-none bg-transparent text-transparent caret-white outline-none"
      @input="resize"
      @keydown.tab="onTab"
    />
  </div>
</template>

<style scoped>
/* pre e textarea precisam do MESMO box pra o texto colorido casar com o cursor */
.codefield-box {
  padding: 0.75rem;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font: inherit;
  tab-size: 2;
}

.codefield :deep(code) {
  font: inherit;
  white-space: inherit;
}
</style>
