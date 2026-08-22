import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioReviewTimeline from '~/components/scenario/review/timeline.vue'
import type { RecorderEvent } from '~/composables/webdriver'

const events = [
  { type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 },
  { type: 'fill', label: 'E-mail', value: 'a@b.c', timestamp: 3000 },
  { type: 'submit', timestamp: 5000 }
] as unknown as RecorderEvent[]

function mount(props: Record<string, unknown> = {}) {
  return mountSuspended(ScenarioReviewTimeline, { props: { events, ...props } })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ScenarioReviewTimeline', () => {
  it('descreve cada evento gravado, sem vídeo nem instantes', async () => {
    const wrapper = await mount()

    expect(wrapper.findAll('[data-testid="revisao-evento"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Navega para "/login"')
    expect(wrapper.find('[data-testid="revisao-video"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('0.0s')
  })

  it('marca o instante de cada evento junto do vídeo', async () => {
    const wrapper = await mount({ videoSrc: 'blob:video', recordingStartedAt: 1000 })

    expect(wrapper.get('[data-testid="revisao-video"]').attributes('src')).toBe('blob:video')
    expect(wrapper.text()).toContain('0.0s')
    expect(wrapper.text()).toContain('2.0s')
    expect(wrapper.text()).toContain('4.0s')
  })

  it('segue o vídeo destacando o evento daquele instante', async () => {
    const wrapper = await mount({ videoSrc: 'blob:video', recordingStartedAt: 1000 })
    const video = wrapper.get('[data-testid="revisao-video"]')

    ;(video.element as HTMLVideoElement).currentTime = 2
    await video.trigger('timeupdate')

    expect(wrapper.findAll('[data-testid="revisao-evento"]').map(item => item.attributes('data-current')))
      .toEqual(['false', 'true', 'false'])
  })

  it('pula o vídeo para o evento clicado', async () => {
    const wrapper = await mount({ videoSrc: 'blob:video', recordingStartedAt: 1000 })

    await wrapper.findAll('[data-testid="revisao-evento"]')[2]!.trigger('click')

    expect((wrapper.get('[data-testid="revisao-video"]').element as HTMLVideoElement).currentTime).toBe(4)
    expect(wrapper.findAll('[data-testid="revisao-evento"]')[2]!.attributes('data-current')).toBe('true')
  })

  it('não oferece retomada quando a timeline é só de leitura', async () => {
    const wrapper = await mount()

    expect(wrapper.find('[data-testid="revisao-retomar"]').exists()).toBe(false)
  })

  it('só oferece o corte entre dois passos, porque antes do primeiro não há o que manter', async () => {
    const wrapper = await mount({ resumable: true })

    expect(wrapper.findAll('[data-testid="revisao-retomar"]')).toHaveLength(events.length - 1)
  })

  it('o primeiro clique arma o corte sem retomar nada', async () => {
    vi.useFakeTimers()
    const wrapper = await mount({ resumable: true })
    const corte = wrapper.findAll('[data-testid="revisao-retomar"]')[1]!

    await corte.trigger('click')

    expect(wrapper.emitted('resume')).toBeUndefined()
    expect(corte.attributes('data-armed')).toBe('true')
    expect(wrapper.findAll('[data-testid="revisao-evento"]')[2]!.attributes('data-dropped')).toBe('true')
  })

  it('o clique que chega antes da trava de tempo não retoma', async () => {
    vi.useFakeTimers()
    const wrapper = await mount({ resumable: true })
    const corte = wrapper.findAll('[data-testid="revisao-retomar"]')[1]!

    await corte.trigger('click')
    await vi.advanceTimersByTimeAsync(200)
    await corte.trigger('click')

    expect(wrapper.emitted('resume')).toBeUndefined()
  })

  it('retoma no segundo clique, depois de a trava completar', async () => {
    vi.useFakeTimers()
    const wrapper = await mount({ resumable: true })
    const corte = wrapper.findAll('[data-testid="revisao-retomar"]')[1]!

    await corte.trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    await corte.trigger('click')

    expect(wrapper.emitted('resume')).toEqual([[2]])
  })

  it('desarma sozinho quando o corte fica armado sem confirmação', async () => {
    vi.useFakeTimers()
    const wrapper = await mount({ resumable: true })
    const corte = wrapper.findAll('[data-testid="revisao-retomar"]')[1]!

    await corte.trigger('click')
    await vi.advanceTimersByTimeAsync(6000)

    expect(corte.attributes('data-armed')).toBe('false')

    await corte.trigger('click')
    expect(wrapper.emitted('resume')).toBeUndefined()
  })

  it('armar outro corte desarma o anterior', async () => {
    vi.useFakeTimers()
    const wrapper = await mount({ resumable: true })
    const cortes = wrapper.findAll('[data-testid="revisao-retomar"]')

    await cortes[0]!.trigger('click')
    await vi.advanceTimersByTimeAsync(700)
    await cortes[1]!.trigger('click')

    expect(cortes[0]!.attributes('data-armed')).toBe('false')
    expect(cortes[1]!.attributes('data-armed')).toBe('true')
    expect(wrapper.emitted('resume')).toBeUndefined()
  })

  it('não quebra ao clicar num evento sem vídeo na tela', async () => {
    const wrapper = await mount()

    await wrapper.findAll('[data-testid="revisao-evento"]')[1]!.trigger('click')

    // Sem vídeo todo evento marca 0s, então o destaque fica no último.
    expect(wrapper.findAll('[data-testid="revisao-evento"]').at(-1)!.attributes('data-current')).toBe('true')
  })
})
