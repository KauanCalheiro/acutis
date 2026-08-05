<script setup lang="ts">
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-gherkin'

interface BaseCodefield {
  language: 'typescript' | 'gherkin'
  testid?: string
  readonly?: boolean
}

const { language, testid, readonly = false } = defineProps<BaseCodefield>()

const model = defineModel<string>({
  default: ''
})

const textarea = ref<HTMLTextAreaElement | null>(null)

const highlighted = computed(() =>
  // ponytail: v-html do próprio rascunho do usuário; Prism.highlight escapa entidades
  Prism.highlight(model.value, Prism.languages[language]!, language) + '\n'
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
  <div class="codefield relative overflow-hidden rounded-md bg-elevated font-mono text-sm/6">
    <pre
      aria-hidden="true"
      class="codefield-box pointer-events-none absolute inset-0 m-0 overflow-hidden"
    ><code v-html="highlighted" /></pre>
    <textarea
      ref="textarea"
      v-model="model"
      :data-testid="testid"
      :readonly="readonly"
      spellcheck="false"
      class="codefield-box relative block w-full resize-none bg-transparent text-transparent caret-[var(--ui-text-highlighted)] outline-none"
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

<style>
/* ponytail: paleta própria em vez de um tema Prism fixo, assim acompanha .dark do Nuxt UI;
   token.* são gerados via v-html, escopo global necessário pra CSS scoped não alcançar */
.codefield .token.comment {
  color: #6a737d;
}

.codefield .token.keyword,
.codefield .token.feature,
.codefield .token.scenario,
.codefield .token.outline,
.codefield .token.important,
.codefield .token.atrule {
  color: #d73a49;
}

.codefield .token.string,
.codefield .token.pystring {
  color: #22863a;
}

.codefield .token.function {
  color: #6f42c1;
}

.codefield .token.number,
.codefield .token.boolean {
  color: #005cc5;
}

.codefield .token.class-name,
.codefield .token.tag {
  color: #e36209;
}

.codefield .token.attr-name {
  color: #6f42c1;
}

.codefield .token.punctuation,
.codefield .token.operator {
  color: #24292e;
}

.dark .codefield .token.comment {
  color: #8b949e;
}

.dark .codefield .token.keyword,
.dark .codefield .token.feature,
.dark .codefield .token.scenario,
.dark .codefield .token.outline,
.dark .codefield .token.important,
.dark .codefield .token.atrule {
  color: #ff7b72;
}

.dark .codefield .token.string,
.dark .codefield .token.pystring {
  color: #a5d6ff;
}

.dark .codefield .token.function {
  color: #d2a8ff;
}

.dark .codefield .token.number,
.dark .codefield .token.boolean {
  color: #79c0ff;
}

.dark .codefield .token.class-name,
.dark .codefield .token.tag {
  color: #7ee787;
}

.dark .codefield .token.attr-name {
  color: #d2a8ff;
}

.dark .codefield .token.punctuation,
.dark .codefield .token.operator {
  color: #c9d1d9;
}
</style>
