<script setup lang="ts">
import type { SelectorSuggestion } from '~/types/project'

interface ScenarioSuggestionsModal {
  slug: string
  scenarioId: string
}

const { slug, scenarioId } = defineProps<ScenarioSuggestionsModal>()

const open = defineModel<boolean>('open', {
  default: false
})

const loading = ref(false)
const suggestions = ref<SelectorSuggestion[]>([])
const error = ref<string | null>(null)

watch(open, async (isOpen) => {
  if (!isOpen) return

  loading.value = true
  error.value = null
  suggestions.value = []

  try {
    suggestions.value = await $fetch<SelectorSuggestion[]>(`/api/projects/${slug}/scenario-suggestions`, {
      method: 'POST',
      body: { scenarioId }
    })
  } catch {
    error.value = 'Não foi possível gerar sugestões agora. Tente novamente.'
  } finally {
    loading.value = false
  }
})

const copied = ref<number | null>(null)

function copy(testId: string, index: number) {
  navigator.clipboard?.writeText(testId)
  copied.value = index
  setTimeout(() => {
    if (copied.value === index) copied.value = null
  }, 1500)
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    title="Sugestões de seletores"
    :loading="loading"
    wide
  >
    <template #body>
      <ScenarioSuggestionsLoading v-if="loading" />

      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        :description="error"
      />

      <p
        v-else-if="suggestions.length === 0"
        class="py-6 text-center text-muted"
        data-testid="sugestoes-vazio"
      >
        Nenhuma sugestão — todos os eventos já têm um data-testid.
      </p>

      <div
        v-else
        class="flex flex-col gap-3"
      >
        <UCard
          v-for="(suggestion, i) in suggestions"
          :key="i"
          data-testid="sugestao-card"
        >
          <div class="flex flex-col gap-1">
            <p class="text-sm font-semibold">
              {{ suggestion.event }}
            </p>
            <p class="text-xs text-muted">
              Seletor atual: <code>{{ suggestion.currentSelector }}</code>
            </p>
            <div class="flex items-center gap-2 mt-1">
              <code
                class="rounded bg-elevated px-2 py-1 text-xs"
                data-testid="sugestao-testid"
              >data-testid="{{ suggestion.suggestedTestId }}"</code>
              <BaseButtonIcon
                :icon="copied === i ? 'i-ic-round-check' : 'i-ic-round-content-copy'"
                :label="copied === i ? 'Copiado!' : 'Copiar'"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="copy(suggestion.suggestedTestId, i)"
              />
            </div>
            <p class="text-xs text-dimmed mt-1">
              {{ suggestion.reason }}
            </p>
          </div>
        </UCard>
      </div>
    </template>

    <template #footer>
      <UButton
        label="Fechar"
        color="neutral"
        variant="ghost"
        data-testid="sugestoes-fechar"
        @click="open = false"
      />
    </template>
  </BaseModal>
</template>
