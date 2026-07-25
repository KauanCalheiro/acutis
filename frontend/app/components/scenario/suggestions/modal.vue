<script setup lang="ts">
import type { SelectorSuggestion } from '~/types/project'

interface ScenarioSuggestionsModal {
  loading?: boolean
  suggestions?: SelectorSuggestion[]
  error?: string | null
}

const { loading = false, suggestions = [], error = null } = defineProps<ScenarioSuggestionsModal>()

const open = defineModel<boolean>('open', {
  default: false
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
        icon="i-ic-round-error-outline"
        title="Não foi possível gerar sugestões"
        :description="error"
      />

      <UAlert
        v-else-if="suggestions.length === 0"
        color="success"
        variant="soft"
        icon="i-ic-round-check-circle"
        title="Nenhuma sugestão necessária"
        description="Todos os eventos já têm um data-testid."
        data-testid="sugestoes-vazio"
      />

      <div
        v-else
        class="flex flex-col gap-3"
      >
        <UCard
          v-for="(suggestion, i) in suggestions"
          :key="i"
          data-testid="sugestao-card"
        >
          <div class="flex gap-3">
            <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <UIcon
                name="i-ic-round-select-all"
                class="size-5 text-primary"
              />
            </div>

            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">
                {{ suggestion.event }}
              </p>
              <p class="text-xs text-dimmed mt-0.5">
                {{ suggestion.reason }}
              </p>

              <div class="flex flex-wrap items-center gap-2 mt-3">
                <UBadge
                  color="error"
                  class="font-mono line-through decoration-error/50"
                  size="xl"
                >
                  {{ suggestion.currentSelector }}
                </UBadge>

                <UIcon
                  name="i-ic-round-keyboard-arrow-right"
                  class="size-8 shrink-0 text-dimmed"
                />

                <UTooltip
                  :text="copied === i ? 'Copiado!' : 'Clique para copiar'"
                  :delay-duration="0"
                  arrow
                >
                  <UButton
                    :color="copied === i ? 'success' : 'primary'"
                    variant="soft"
                    :trailing-icon="copied === i ? 'i-ic-round-check' : 'i-ic-round-content-copy'"
                    data-testid="sugestao-testid"
                    size="lg"
                    @click="copy(suggestion.suggestedTestId, i)"
                  >
                    <code class="font-mono">data-testid="{{ suggestion.suggestedTestId }}"</code>
                  </UButton>
                </UTooltip>
              </div>
            </div>
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
