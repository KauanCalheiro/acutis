import { describe, expect, it } from 'vitest'
import ProjectRunFilteredModal from '~/components/project/run-filtered/modal.vue'
import { dismiss, field, openModal, settle } from '../../../support/modal'
import type { RunTest } from '~/composables/run-stream'

function test(overrides: Partial<RunTest> = {}): RunTest {
  return {
    id: 't1',
    title: 'Login do cliente',
    status: 'success',
    error: null,
    steps: [{ testId: 't1', title: 'abre o login', status: 'success', error: null }],
    ...overrides
  } as RunTest
}

function open(props: Record<string, unknown> = {}) {
  return openModal(ProjectRunFilteredModal, { projectName: 'Alpha Store', slug: 'alpha-store', ...props })
}

describe('ProjectRunFilteredModal', () => {
  it('mostra a espera enquanto nenhum teste começou', async () => {
    await open({ running: true })

    expect(field('execucao-iniciando')).toBeDefined()
    expect(document.body.textContent).toContain('Testando cenários filtrados')
    expect(field('execucao-fechar')).toBeUndefined()
  })

  it('resume a execução que passou', async () => {
    await open({
      passed: true,
      filter: 'Login',
      testedAt: '01/01/2026 10:00',
      tests: [test()]
    })

    expect(field('execucao-status')!.textContent).toContain('Sucesso')
    expect(field('execucao-detalhes')!.textContent).toContain('Alpha Store')
    expect(field('execucao-detalhes')!.textContent).toContain('Login')
    expect(field('execucao-detalhes')!.textContent).toContain('01/01/2026 10:00')
    expect(field('execucao-teste-titulo')!.textContent).toContain('Login do cliente')
  })

  it('marca a falha e já abre o teste que falhou', async () => {
    await open({
      tests: [test({ status: 'failed', error: 'page.goto timed out', steps: [] })]
    })

    expect(field('execucao-status')!.textContent).toContain('Falha')
    expect(field('execucao-teste-erro')!.textContent).toContain('page.goto timed out')
  })

  it('cala o erro do teste quando um passo já explica a falha', async () => {
    await open({
      tests: [test({
        status: 'failed',
        error: 'resumo do runner',
        steps: [{ testId: 't1', title: 'entra', status: 'failed', error: 'locator não encontrado' }]
      })]
    })

    expect(field('execucao-teste-erro')).toBeUndefined()
    expect(document.body.textContent).toContain('locator não encontrado')
  })

  it('avisa quando o runner morreu antes de rodar', async () => {
    await open({ output: 'Error: no tests found', tests: [] })

    expect(field('execucao-saida')!.textContent).toContain('Error: no tests found')
    expect(field('execucao-detalhes')!.textContent).toContain('Cenários: 0')
  })

  it('leva ao relatório do Playwright e fecha', async () => {
    const { state } = await open({ tests: [test()] })

    expect(field('execucao-relatorio')!.getAttribute('href')).toContain('alpha-store')

    field('execucao-fechar')!.click()
    await settle()

    expect(state.value).toBe(false)
  })

  it('fecha pelo esc quando a execução já terminou', async () => {
    const { state } = await open({ tests: [test()] })

    await dismiss()

    expect(state.value).toBe(false)
  })

  it('fecha e reabre o teste no clique', async () => {
    await open({ tests: [test({ status: 'failed', error: null, steps: [] })] })

    expect(document.body.textContent).toContain('Nenhum passo reportado.')

    field('execucao-teste-abrir')!.click()
    await settle()

    expect(document.body.textContent).not.toContain('Nenhum passo reportado.')
  })
})
