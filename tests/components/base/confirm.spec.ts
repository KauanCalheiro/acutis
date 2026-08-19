import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h, ref } from 'vue'
import BaseConfirm from '~/components/base/confirm.vue'

/** O UModal teleporta o conteúdo, então o que a tela mostra está no body, não no wrapper. */
function body() {
  return document.body
}

/** O último, porque o modal de cada caso fica no body depois que o teste termina. */
function button(testid: string) {
  return [...body().querySelectorAll<HTMLButtonElement>(`[data-testid="${testid}"]`)].at(-1)
}

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

/** Um pai de mentira com o v-model:open, que é como a tela usa o confirm. */
async function open(props: Record<string, unknown> = {}) {
  const state = ref(true)
  const confirmed = ref(0)

  const host = defineComponent({
    setup() {
      return () => h(BaseConfirm, {
        'title': 'Excluir projeto',
        ...props,
        'open': state.value,
        'onUpdate:open': (value: boolean) => (state.value = value),
        'onConfirm': () => confirmed.value++
      })
    }
  })

  await mountSuspended(host)
  await settle()

  return { state, confirmed }
}

describe('BaseConfirm', () => {
  it('pergunta com o título e a descrição, e confirma', async () => {
    const { confirmed, state } = await open({
      description: 'Isso apaga os testes gravados.',
      confirmLabel: 'Excluir'
    })

    expect(body().textContent).toContain('Excluir projeto')
    expect(body().textContent).toContain('Isso apaga os testes gravados.')

    button('confirmar')!.click()
    await settle()

    expect(confirmed.value).toBe(1)
    expect(state.value).toBe(true)
  })

  it('fecha ao cancelar, sem confirmar', async () => {
    const { confirmed, state } = await open()

    button('confirmar-cancelar')!.click()
    await settle()

    expect(confirmed.value).toBe(0)
    expect(state.value).toBe(false)
  })

  it('fecha quando o próprio modal se fecha', async () => {
    const { state } = await open()

    body().querySelector<HTMLElement>('[role="dialog"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()

    expect(state.value).toBe(false)
  })

  it('usa o testid pedido para o botão de confirmar', async () => {
    await open({ confirmTestid: 'excluir-projeto', confirmColor: 'error', loading: true })

    expect(button('excluir-projeto')).not.toBeNull()
  })
})
