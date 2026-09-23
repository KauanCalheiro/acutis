import { beforeEach, describe, expect, it } from 'vitest'
import BaseModal from '~/components/base/modal.vue'
import { useWalkthroughRunning } from '~/composables/walkthrough'
import { openModal } from '../../support/modal'

let mounted: Awaited<ReturnType<typeof openModal>>['wrapper'] | undefined

async function openBaseModal() {
  const { wrapper } = await openModal(BaseModal)
  mounted = wrapper

  return wrapper.findComponent({ name: 'UModal' })
}

describe('BaseModal', () => {
  beforeEach(() => {
    mounted?.unmount()
    mounted = undefined
    useWalkthroughRunning().value = false
  })

  it('trava a página por trás enquanto nenhuma apresentação roda', async () => {
    const modal = await openBaseModal()

    expect(modal.props('modal')).toBe(true)
  })

  it('libera a página por trás enquanto uma apresentação roda', async () => {
    useWalkthroughRunning().value = true

    const modal = await openBaseModal()

    expect(modal.props('modal')).toBe(false)
  })

  it('não fecha por clique fora enquanto uma apresentação roda', async () => {
    useWalkthroughRunning().value = true

    const modal = await openBaseModal()

    expect(modal.props('dismissible')).toBe(false)
  })
})
