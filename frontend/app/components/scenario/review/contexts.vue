<script setup lang="ts">
import type { TestDraft } from '~/types/project'

interface ScenarioReviewContexts {
  /**
   * O cenário de autenticação mora num caminho fixo e roda como setup de todos os outros, então
   * arquivo, domínio e tags não são dele.
   */
  isAuth?: boolean
}

const { isAuth = false } = defineProps<ScenarioReviewContexts>()

const draft = defineModel<TestDraft>('draft', {
  required: true
})

function tagsFromLine(line: string): string[] {
  return line.match(/@[\w-]+/g) ?? []
}

function tagsFromGherkin(gherkin: string): string[] {
  const firstLine = gherkin.split('\n')[0] ?? ''
  return firstLine.trim().startsWith('@') ? tagsFromLine(firstLine) : []
}

function tagsFromPlaywright(playwright: string): string[] {
  const match = playwright.match(/tag:\s*\[([^\]]*)\]/)
  return match ? tagsFromLine(match[1]!) : []
}

function stampGherkinTags(gherkin: string, tags: string[]): string {
  const lines = gherkin.split('\n')
  if (lines[0]?.trim().startsWith('@')) lines.shift()
  const body = lines.join('\n')
  return tags.length ? `${tags.join(' ')}\n${body}` : body
}

function stampPlaywrightTags(playwright: string, tags: string[]): string {
  if (!tags.length) return playwright

  const list = `tag: [${tags.map(t => `'${t}'`).join(', ')}]`

  if (/tag:\s*\[[^\]]*\]/.test(playwright)) {
    return playwright.replace(/tag:\s*\[[^\]]*\]/, list)
  }

  return playwright.replace(
    /test\.describe\(\s*((["']).+?\2)\s*,\s*(?=\(|async)/,
    `test.describe($1, { ${list} }, `
  )
}

// ponytail: guarda contra loop de re-entrada entre os 3 watchers que espelham a mesma lista de tags
let syncing = false

function applyTags(tags: string[]) {
  syncing = true
  draft.value = {
    ...draft.value,
    tags,
    gherkin: stampGherkinTags(draft.value.gherkin, tags),
    playwright: stampPlaywrightTags(draft.value.playwright, tags)
  }
  nextTick(() => {
    syncing = false
  })
}

const tagsText = computed({
  get: () => draft.value.tags.join(' '),
  set: (value: string) => applyTags(tagsFromLine(value))
})

watch(() => draft.value.gherkin, (gherkin) => {
  if (syncing) return
  const tags = tagsFromGherkin(gherkin)
  if (tags.join(' ') !== draft.value.tags.join(' ')) applyTags(tags)
})

watch(() => draft.value.playwright, (playwright) => {
  if (syncing) return
  const tags = tagsFromPlaywright(playwright)
  if (tags.length && tags.join(' ') !== draft.value.tags.join(' ')) applyTags(tags)
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UFormField label="Título do cenário">
        <UInput
          v-model="draft.title"
          data-testid="contexto-titulo"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="!isAuth"
        label="Arquivo"
        help="Nome do .spec.ts / .feature"
      >
        <UInput
          v-model="draft.path"
          data-testid="contexto-path"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      v-if="!isAuth"
      label="Domínio"
      help="Pasta onde o cenário será salvo (ex.: login, checkout)"
    >
      <UInput
        v-model="draft.domain"
        data-testid="contexto-dominio"
        class="w-full"
      />
    </UFormField>

    <UFormField
      v-if="!isAuth"
      label="Tags"
      help="Separadas por espaço (ex.: @read @criando)"
    >
      <UInput
        v-model="tagsText"
        data-testid="contexto-tags"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Cenário (Gherkin)">
      <BaseCodefield
        v-model="draft.gherkin"
        language="gherkin"
        testid="contexto-cenario"
      />
    </UFormField>

    <UFormField label="Teste (Playwright)">
      <BaseCodefield
        v-model="draft.playwright"
        language="typescript"
        testid="contexto-teste"
      />
    </UFormField>
  </div>
</template>
