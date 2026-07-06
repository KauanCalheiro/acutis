<script setup lang="ts">
import type { RecorderEvent } from '~/composables/webdriver'
import type { TestDraft } from '~/types/project'

interface ScenarioReviewModal {
  slug: string
}

const { slug } = defineProps<ScenarioReviewModal>()

const open = defineModel<boolean>('open', {
  default: false,
})

const emit = defineEmits<{
  generated: []
  rerecord: []
}>()

const { state, url } = useWebdriver()

function emptyDraft(): TestDraft {
  return { title: '', tags: [], path: '', gherkin: '', playwright: '' }
}

const step = ref<'review' | 'loading' | 'edit'>('review')
const draft = ref<TestDraft>(emptyDraft())
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) {
    step.value = 'review'
    draft.value = emptyDraft()
    error.value = null
  }
})

const modalTitle = computed(() => {
  if (step.value === 'loading') return 'Gerando cenário'
  if (step.value === 'edit') return 'Revise os contextos'
  return 'Revise seus eventos'
})

const videoEl = ref<HTMLVideoElement | null>(null)
const currentTime = ref(0)

const timeline = computed(() =>
  state.value.events
    .filter(event => event.type && event.timestamp)
    .sort((a, b) => a.timestamp! - b.timestamp!),
)

const eventIcons: Record<string, string> = {
  navigate: 'i-ic-round-public',
  click: 'i-ic-round-ads-click',
  fill: 'i-ic-round-edit',
  submit: 'i-ic-round-send',
  hover: 'i-ic-round-mouse',
  assert: 'i-ic-round-check-circle',
}

function offsetSeconds(event: RecorderEvent): number {
  if (!state.value.recordingStartedAt || !event.timestamp) return 0
  return Math.max(0, (event.timestamp - state.value.recordingStartedAt) / 1000)
}

const currentIndex = computed(() => {
  let index = -1
  timeline.value.forEach((event, i) => {
    if (offsetSeconds(event) <= currentTime.value) index = i
  })
  return index
})

function describe(event: RecorderEvent): string {
  const selector = event.selectors
  return event.label || selector?.text || selector?.dataTestId || selector?.cssStable || event.url || event.type || ''
}

function seekTo(event: RecorderEvent) {
  if (!videoEl.value) return
  const offset = offsetSeconds(event)
  videoEl.value.currentTime = offset
  currentTime.value = offset
}

const submitting = ref(false)

const baseUrl = computed(() => {
  const first = timeline.value.find(event => event.url)
  if (!first?.url) return null
  try {
    return new URL(first.url).origin
  } catch {
    return null
  }
})

async function generate() {
  if (!baseUrl.value) {
    error.value = 'Nenhuma navegação registrada na gravação.'
    return
  }

  error.value = null
  step.value = 'loading'

  try {
    draft.value = await $fetch<TestDraft>(`/api/projects/${slug}/tests/draft`, {
      method: 'POST',
      body: {
        baseUrl: baseUrl.value,
        events: timeline.value.map(event => ({
          type: event.type,
          timestamp: event.timestamp,
          url: event.url ?? null,
          selectors: event.selectors ?? null,
          label: event.label ?? null,
          value: event.value ?? null,
        })),
      },
    })
    step.value = 'edit'
  } catch {
    error.value = 'Não foi possível gerar o cenário. Tente novamente.'
    step.value = 'review'
  }
}

async function commit() {
  if (!draft.value) return

  submitting.value = true
  error.value = null

  try {
    await $fetch(`/api/projects/${slug}/tests`, {
      method: 'POST',
      body: draft.value,
    })
    open.value = false
    emit('generated')
  } catch {
    error.value = 'Não foi possível salvar o cenário. Tente novamente.'
  } finally {
    submitting.value = false
  }
}

function rerecord() {
  open.value = false
  emit('rerecord')
}
</script>

<template>
  <BaseModal
    v-model:open="open"
    :title="modalTitle"
    :dismissable="false"
    wide
  >
    <template #body>
      <ScenarioReviewLoading v-if="step === 'loading'" />

      <ScenarioReviewContexts
        v-else-if="step === 'edit'"
        v-model:draft="draft"
      />

      <div
        v-else
        class="grid grid-cols-1 gap-6 lg:grid-cols-5"
      >
        <video
          v-if="state.videoSessionId"
          ref="videoEl"
          data-testid="revisao-video"
          :src="`${url}/recording/${state.videoSessionId}`"
          controls
          class="w-full self-start rounded-lg lg:sticky lg:top-0 lg:col-span-3"
          @timeupdate="currentTime = ($event.target as HTMLVideoElement).currentTime"
        />

        <div class="lg:col-span-2">
          <p class="mb-3 font-semibold">
            Timeline dos eventos
          </p>
          <ol class="flex flex-col">
            <li
              v-for="(event, i) in timeline"
              :key="i"
              data-testid="revisao-evento"
              :data-current="i === currentIndex ? 'true' : 'false'"
              class="group flex cursor-pointer items-stretch gap-3"
              @click="seekTo(event)"
            >
              <div class="flex flex-col items-center">
                <UIcon
                  :name="eventIcons[event.type!] ?? 'i-ic-round-help-outline'"
                  class="size-5 shrink-0 transition-colors"
                  :class="i <= currentIndex ? 'text-primary' : 'text-muted'"
                />
                <span
                  v-if="i < timeline.length - 1"
                  class="w-px grow transition-colors"
                  :class="i < currentIndex ? 'bg-primary' : 'bg-accented'"
                />
              </div>
              <div class="pb-4 min-w-0">
                <p
                  class="truncate text-sm transition-colors group-hover:text-highlighted"
                  :class="i === currentIndex ? 'font-semibold text-primary' : 'text-default'"
                >
                  {{ describe(event) }}
                  <template v-if="event.value"> = {{ event.value }}</template>
                </p>
                <p class="text-xs text-dimmed">
                  {{ event.type }} · {{ offsetSeconds(event).toFixed(1) }}s
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        :description="error"
        class="mt-4"
      />
    </template>

    <template
      v-if="step !== 'loading'"
      #footer
    >
      <template v-if="step === 'edit'">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          data-testid="contexto-cancelar"
          @click="open = false"
        />
        <UButton
          label="Enviar"
          :loading="submitting"
          data-testid="contexto-enviar"
          @click="commit"
        />
      </template>

      <template v-else>
        <UButton
          label="Gravar novamente"
          color="neutral"
          variant="soft"
          class="mr-auto"
          data-testid="revisao-regravar"
          @click="rerecord"
        />
        <UButton
          label="Cancelar"
          color="neutral"
          variant="ghost"
          data-testid="revisao-cancelar"
          @click="open = false"
        />
        <UButton
          label="Gerar cenário"
          data-testid="revisao-gerar"
          @click="generate"
        />
      </template>
    </template>
  </BaseModal>
</template>
