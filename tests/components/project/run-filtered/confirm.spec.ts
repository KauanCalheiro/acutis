import { describe, expect, it } from 'vitest'
import ProjectRunFilteredConfirm from '~/components/project/run-filtered/confirm.vue'
import { field, openModal, settle } from '../../../support/modal'

function open(props: Record<string, unknown> = {}) {
  return openModal(ProjectRunFilteredConfirm, { count: 3, ...props })
}

describe('ProjectRunFilteredConfirm', () => {
  it('diz quantos cenários vão rodar', async () => {
    await open()

    expect(document.body.textContent).toContain('3 cenários')
  })

  it('fala no singular quando é um cenário só', async () => {
    await open({ count: 1 })

    expect(document.body.textContent).toContain('1 cenário')
    expect(document.body.textContent).not.toContain('1 cenários')
  })

  it('mostra a busca que filtrou os cenários', async () => {
    await open({ filter: '@write' })

    expect(document.body.textContent).toContain('@write')
  })

  it('confirma a execução', async () => {
    const { events, state } = await open()

    field('projeto-rodar-confirmar')!.click()
    await settle()

    expect(events.confirm).toHaveLength(1)
    expect(state.value).toBe(false)
  })

  it('fecha sem rodar quando o usuário cancela', async () => {
    const { events, state } = await open()

    field('confirmar-cancelar')!.click()
    await settle()

    expect(events.confirm).toBeUndefined()
    expect(state.value).toBe(false)
  })
})
