<script setup lang="ts">
import type { TestDraft } from '~/types/project'

const draft = defineModel<TestDraft>('draft', {
  required: true
})

const tagsText = computed({
  get: () => draft.value.tags.join(' '),
  set: (value: string) => {
    draft.value.tags = value.split(/\s+/).filter(Boolean)
  }
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
      label="Tags"
      help="Separadas por espaço (ex.: @read @login)"
    >
      <UInput
        v-model="tagsText"
        data-testid="contexto-tags"
        class="w-full"
      />
    </UFormField>

    <UFormField label="Cenário (Gherkin)">
      <UTextarea
        v-model="draft.gherkin"
        data-testid="contexto-cenario"
        :rows="8"
        class="w-full font-mono text-sm"
      />
    </UFormField>

    <UFormField label="Teste (Playwright)">
      <UTextarea
        v-model="draft.playwright"
        data-testid="contexto-teste"
        :rows="12"
        class="w-full font-mono text-sm"
      />
    </UFormField>
  </div>
</template>
