import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import ScenarioTestRunModal from '~/components/scenario/test-run/modal.vue'
import { dismiss, field, openModal, settle } from '../../../support/modal'

// A tela lê `configured` como ref; o teste troca o valor entre os casos.
const ai = vi.hoisted(() => ({ configured: { __v_isRef: true, value: false } }))

mockNuxtImport('useAi', () => () => ai)

function open(props: Record<string, unknown> = {}) {
  return openModal(ScenarioTestRunModal, {
    projectName: 'Alpha Store',
    scenarioName: 'Login do cliente',
    ...props
  })
}

const failedStep = [{ title: 'entra', status: 'failed', error: 'locator não encontrado' }]

describe('ScenarioTestRunModal', () => {
  it('espera enquanto a execução não reporta passo', async () => {
    await open({ running: true })

    expect(field('execucao-iniciando')).toBeDefined()
    expect(document.body.textContent).toContain('Testando cenário...')
    expect(field('execucao-fechar')).toBeUndefined()
  })

  it('muda o vocabulário quando o que roda é a autenticação', async () => {
    await open({ running: true, kind: 'autenticacao' })

    expect(document.body.textContent).toContain('Testando autenticação...')
  })

  it('resume a execução que passou, com vídeo e código', async () => {
    await open({
      passed: true,
      branch: 'main',
      testedAt: '01/01/2026 10:00',
      videoUrl: 'http://localhost:4000/runner/video?path=x',
      playwright: 'test("login", async () => {})',
      steps: [{ title: 'abre o login', status: 'success' }]
    })

    expect(field('execucao-status')!.textContent).toContain('Sucesso')
    expect(field('execucao-detalhes')!.textContent).toContain('Alpha Store')
    expect(field('execucao-detalhes')!.textContent).toContain('main')
    expect(field('execucao-detalhes')!.textContent).toContain('01/01/2026 10:00')
    expect(field('execucao-video')).toBeDefined()
    expect((field('execucao-playwright') as HTMLTextAreaElement).value).toContain('test("login"')
  })

  it('mostra o resultado da autenticação com o rótulo dela', async () => {
    await open({ passed: true, kind: 'autenticacao', steps: [{ title: 'entra', status: 'success' }] })

    expect(document.body.textContent).toContain('Resultado da autenticação')
    expect(field('execucao-detalhes')!.textContent).toContain('Autenticação:')
  })

  it('mostra a saída do runner que morreu antes de rodar', async () => {
    await open({ output: 'Error: no tests found' })

    expect(field('execucao-saida')!.textContent).toContain('Error: no tests found')
  })

  it('não oferece corrigir sem IA configurada', async () => {
    ai.configured.value = false
    await open({ steps: failedStep })

    expect(field('execucao-corrigir')!.className).toContain('pointer-events-none')
  })

  it('pede a correção do passo que falhou quando há IA', async () => {
    ai.configured.value = true
    const { wrapper } = await open({ steps: failedStep })

    field('execucao-corrigir')!.click()
    await settle()

    expect(wrapper.findComponent(ScenarioTestRunModal).emitted('fix')).toHaveLength(1)
  })

  it('não oferece corrigir o que passou', async () => {
    ai.configured.value = true
    await open({ passed: true, steps: [{ title: 'entra', status: 'success' }] })

    expect(field('execucao-corrigir')).toBeUndefined()
  })

  it('adianta o vídeo para um quadro com conteúdo', async () => {
    await open({ videoUrl: 'http://localhost:4000/runner/video?path=x', steps: [] })

    const video = field('execucao-video') as HTMLVideoElement

    Object.defineProperty(video, 'duration', { value: 8, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    expect(video.currentTime).toBe(2)
  })

  it('fecha pelo botão', async () => {
    const { state } = await open({ steps: [] })

    field('execucao-fechar')!.click()
    await settle()

    expect(state.value).toBe(false)
  })

  it('fecha pelo esc', async () => {
    const { state } = await open({ steps: [] })

    await dismiss()

    expect(state.value).toBe(false)
  })
})
