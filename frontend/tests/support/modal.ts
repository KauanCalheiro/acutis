import { afterEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref } from 'vue'
import type { Component } from 'vue'
import { UApp } from '#components'

// O modal teleportado fica no body depois do teste; sem limpar, o caso seguinte acha o do anterior.
afterEach(() => {
  document.body.innerHTML = ''
})

/** O UModal teleporta o conteúdo para o body; cada caso deixa o seu lá, então vale o último. */
export function field(testid: string) {
  return [...document.body.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)].at(-1)
}

export async function settle(rounds = 3) {
  for (let round = 0; round < rounds; round++) {
    await nextTick()
    // Com relógio falso, esperar o setTimeout de verdade travaria o teste.
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0)
    else await new Promise(resolve => setTimeout(resolve, 0))
  }
}

/** Fecha o modal pelo Esc, que é o caminho do próprio UModal e não passa pelos botões. */
export async function dismiss() {
  const dialogs = [...document.body.querySelectorAll<HTMLElement>('[role="dialog"]')]

  dialogs.at(-1)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await settle()
}

export async function type(testid: string, value: string) {
  const input = field(testid) as HTMLInputElement

  input.value = value
  input.dispatchEvent(new Event('input'))
  await settle(1)
}

/**
 * Abre o modal por um pai de mentira com `v-model:open`, que é como as telas usam todos eles.
 * Devolve o estado do pai para o teste conferir o que o modal fez com ele.
 */
export async function openModal(component: Component, props: Record<string, unknown> = {}) {
  const state = ref(false)
  const events: Record<string, unknown[][]> = {}

  const record = (name: string) => (...args: unknown[]) => {
    (events[name] ??= []).push(args)
  }

  const host = defineComponent({
    setup() {
      return () => h(UApp, null, {
        default: () => h(component, {
          ...props,
          'open': state.value,
          'onUpdate:open': (value: boolean) => (state.value = value),
          'onSaved': record('saved'),
          'onRenamed': record('renamed'),
          'onConfirm': record('confirm'),
          'onGenerated': record('generated'),
          'onUpdated': record('updated'),
          'onRerecord': record('rerecord')
        })
      })
    }
  })

  const wrapper = await mountSuspended(host)
  state.value = true
  await settle()

  return { wrapper, state, events }
}
