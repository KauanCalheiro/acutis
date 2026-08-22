// @vitest-environment jsdom
/** A pill montada isolada: o botão de cancelar e a confirmação que ele abre. */
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Pill from '../Pill.vue'
import { usePillState } from '../usePillState'

function stubCancelRecording() {
  const cancelar = vi.fn()
  window.__acutisCancelRecording = cancelar
  return cancelar
}

afterEach(() => {
  delete window.__acutisCancelRecording
})

describe('Pill', () => {
  it('troca o ícone do botão pelo check quando a ação dele virou passo, e devolve depois', async () => {
    vi.useFakeTimers()
    const reportado: unknown[] = []
    window.__acutisReportEvent = event => reportado.push(event)
    const wrapper = mount(Pill)
    const urlIcon = () => wrapper.get('[data-acutis="conferir-url"] .icon')

    expect(urlIcon().classes()).not.toContain('confirmed')

    await wrapper.get('[data-acutis="conferir-url"]').trigger('click')

    expect(reportado).toHaveLength(1)
    expect(urlIcon().classes()).toContain('confirmed')

    await vi.advanceTimersByTimeAsync(700)
    await wrapper.vm.$nextTick()

    expect(urlIcon().classes()).not.toContain('confirmed')
    delete window.__acutisReportEvent
    vi.useRealTimers()
  })

  it('confirma no botão da ação, e não nos outros', async () => {
    vi.useFakeTimers()
    const wrapper = mount(Pill)

    usePillState().confirmAction('hover')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-acutis="conferir-url"] .icon').classes()).not.toContain('confirmed')
    expect(wrapper.findAll('.icon.confirmed')).toHaveLength(1)
    vi.useRealTimers()
  })

  it('pede confirmação antes de descartar a gravação', async () => {
    stubCancelRecording()
    const wrapper = mount(Pill)

    expect(wrapper.find('[data-acutis="cancelar-confirmar"]').exists()).toBe(false)

    await wrapper.get('[data-acutis="cancelar"]').trigger('click')

    expect(wrapper.find('[data-acutis="cancelar-confirmar"]').exists()).toBe(true)
  })

  it('não avisa o servidor quando a confirmação é recusada', async () => {
    const cancelar = stubCancelRecording()
    const wrapper = mount(Pill)

    await wrapper.get('[data-acutis="cancelar"]').trigger('click')
    await wrapper.get('[data-acutis="cancelar-nao"]').trigger('click')

    expect(cancelar).not.toHaveBeenCalled()
    expect(wrapper.find('[data-acutis="cancelar-confirmar"]').exists()).toBe(false)
  })

  it('avisa o servidor só depois do sim', async () => {
    const cancelar = stubCancelRecording()
    const wrapper = mount(Pill)

    await wrapper.get('[data-acutis="cancelar"]').trigger('click')
    expect(cancelar).not.toHaveBeenCalled()

    await wrapper.get('[data-acutis="cancelar-sim"]').trigger('click')

    expect(cancelar).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-acutis="cancelar-confirmar"]').exists()).toBe(false)
  })
})
