<script setup lang="ts">
import type { WalkthroughStep } from '~/composables/walkthrough'

interface BaseWalkthrough {
  id: string
  steps: WalkthroughStep[]
  ready?: boolean
}

const {
  id,
  steps,
  ready = true
} = defineProps<BaseWalkthrough>()

const walkthrough = useWalkthrough(id, () => steps, {
  ready: () => ready
})

const FOLLOW_FRAMES = 40

const spotlight = ref<Record<string, string>>()

let frame: number | undefined

/** Recorta o fundo em volta do alvo do passo atual. */
function measureTarget() {
  const reference = walkthrough.reference.value
  const rect = walkthrough.current.value?.testid ? reference?.getBoundingClientRect() : undefined

  spotlight.value = rect
    ? {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      }
    : undefined
}

/** Remede o alvo por alguns quadros seguidos, o tempo de um modal terminar de abrir ou a rolagem assentar. */
function followTarget(framesLeft = FOLLOW_FRAMES) {
  stopFollowing()
  measureTarget()

  if (framesLeft > 0) frame = requestAnimationFrame(() => followTarget(framesLeft - 1))
}

function stopFollowing() {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined
}

function onViewportChange() {
  followTarget()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') walkthrough.finish()
}

function unlisten() {
  stopFollowing()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
}

watch(walkthrough.open, (open) => {
  unlisten()

  if (!open) return

  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

watch([walkthrough.open, walkthrough.index], () => {
  if (walkthrough.open.value) followTarget()
})

onBeforeUnmount(unlisten)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="walkthrough.open.value"
      class="fixed inset-0 z-[55]"
    >
      <div
        v-if="spotlight"
        class="absolute box-content -m-1.5 p-1.5 rounded-lg ring-2 ring-primary shadow-[0_0_0_9999px_rgb(0_0_0/0.6)] transition-all duration-200"
        :style="spotlight"
      />
      <div
        v-else
        class="absolute inset-0 bg-black/60"
      />
    </div>
  </Teleport>

  <UPopover
    :open="walkthrough.open.value"
    :reference="walkthrough.reference.value"
    :dismissible="false"
    :content="{
      side: walkthrough.current.value?.testid ? walkthrough.current.value.side ?? 'bottom' : 'bottom',
      sideOffset: 14
    }"
    :ui="{
      content: 'z-[60] w-96 max-w-[calc(100vw-2rem)]'
    }"
  >
    <template #content>
      <div
        v-if="walkthrough.current.value"
        class="flex flex-col gap-3 p-4"
        data-testid="apresentacao"
      >
        <p class="text-base font-semibold">
          {{ walkthrough.current.value.title }}
        </p>

        <p class="text-sm text-muted">
          {{ walkthrough.current.value.body }}
        </p>

        <ul
          v-if="walkthrough.current.value.items?.length"
          class="flex flex-col gap-1.5 text-sm text-muted"
        >
          <li
            v-for="item in walkthrough.current.value.items"
            :key="item.term"
          >
            <strong class="text-default">{{ item.term }}:</strong> {{ item.text }}
          </li>
        </ul>

        <div class="mt-1 flex items-center justify-between gap-2">
          <span
            class="text-xs text-dimmed"
            data-testid="apresentacao-posicao"
          >{{ walkthrough.index.value + 1 }} de {{ walkthrough.total.value }}</span>

          <div class="flex gap-2">
            <UButton
              v-if="walkthrough.hasNext.value"
              label="Pular"
              color="neutral"
              variant="ghost"
              data-testid="apresentacao-pular"
              @click="walkthrough.finish()"
            />
            <UButton
              v-if="walkthrough.hasPrev.value"
              label="Voltar"
              color="neutral"
              variant="soft"
              data-testid="apresentacao-voltar"
              @click="walkthrough.prev()"
            />
            <UButton
              v-if="walkthrough.hasNext.value"
              label="Avançar"
              trailing-icon="i-ic-round-arrow-forward"
              data-testid="apresentacao-avancar"
              @click="walkthrough.next()"
            />
            <UButton
              v-else
              label="Concluir"
              icon="i-ic-round-check"
              data-testid="apresentacao-concluir"
              @click="walkthrough.finish()"
            />
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
