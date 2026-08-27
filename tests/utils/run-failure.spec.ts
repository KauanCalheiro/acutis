import { describe, expect, it } from 'vitest'
import { describeRunFailure } from '~/utils/run-failure'

/** O call log do Playwright, cujo marcador de item não sobrevive escrito literalmente aqui. */
function callLog(...lines: string[]) {
  return ['Call log:', ...lines.map(line => `  ${String.fromCharCode(45)} ${line}`)].join('\n')
}

describe('describeRunFailure', () => {
  it('diz qual seletor não apareceu e em quanto tempo', () => {
    const failure = describeRunFailure([
      'Error: expect(locator).toBeVisible() failed',
      '',
      'Locator: getByText(\'Conclusão do curs\', { exact: true })',
      'Expected: visible',
      'Timeout: 5000ms',
      'Error: element(s) not found',
      '',
      callLog('Expect "toBeVisible" with timeout 5000ms')
    ].join('\n'))

    expect(failure.summary).toBe('Não achei Conclusão do curs na página depois de 5s.')
    expect(failure.hint).toContain('Regravar')
  })

  it('separa o elemento que existe do elemento que não existe', () => {
    const failure = describeRunFailure([
      'Error: expect(locator).toBeVisible() failed',
      '',
      'Locator: locator(\'.dialog:nth-child(11) .button-action\')',
      'Expected: visible',
      'Timeout: 15000ms'
    ].join('\n'))

    expect(failure.summary).toBe('.dialog:nth-child(11) .button-action está na página, mas continuou escondido por 15s.')
  })

  it('explica o endereço que não respondeu', () => {
    const failure = describeRunFailure([
      'Error: page.goto: net::ERR_NAME_NOT_RESOLVED at https://plataformadevel/',
      callLog('navigating to "https://plataformadevel/", waiting until "load"')
    ].join('\n'))

    expect(failure.summary).toBe('O endereço https://plataformadevel/ não respondeu: o domínio não existe.')
    expect(failure.hint).toContain('ambiente')
  })

  it('conta quantos elementos o seletor ambíguo casou', () => {
    const failure = describeRunFailure([
      'Error: locator.click: Error: strict mode violation: locator(\'.button\') resolved to 3 elements:',
      '    1) <button class="button">…',
      '    2) <button class="button">…'
    ].join('\n'))

    expect(failure.summary).toBe('O seletor .button casou 3 elementos, então não identifica um só.')
    expect(failure.hint).toContain('data-testid')
  })

  it('conta o tempo total quando o cenário inteiro estourou', () => {
    const failure = describeRunFailure('Test timeout of 30000ms exceeded.')

    expect(failure.summary).toBe('O cenário passou de 30s no total e foi interrompido.')
  })

  it('diz qual ação não conseguiu acontecer no elemento', () => {
    const failure = describeRunFailure([
      'TimeoutError: locator.click: Timeout 15000ms exceeded.',
      callLog('waiting for getByTestId(\'calendar-event-save\')')
    ].join('\n'))

    expect(failure.summary).toBe('Não consegui clicar em calendar-event-save: o elemento não ficou pronto em 15s.')
  })

  it('mostra a diferença entre o texto esperado e o que a página trouxe', () => {
    const failure = describeRunFailure([
      'Error: expect(locator).toHaveText(expected) failed',
      '',
      'Locator: getByTestId(\'saldo\')',
      'Expected string: "R$ 100,00"',
      'Received string: "R$ 0,00"'
    ].join('\n'))

    expect(failure.summary).toBe('saldo mostrava "R$ 0,00", e o cenário esperava "R$ 100,00".')
  })

  it('lê o esperado e o encontrado do formato sem a palavra string', () => {
    const failure = describeRunFailure([
      'Error: expect(page).toHaveTitle(expected) failed',
      '',
      'Expected: "Portal do Aluno"',
      'Received: "Plataforma Univates"',
      'Timeout:  5000ms'
    ].join('\n'))

    expect(failure!.summary).toBe('A página mostrava "Plataforma Univates", e o cenário esperava "Portal do Aluno".')
  })

  it('diz por quem o cenário esperava quando o tempo total acabou', () => {
    const failure = describeRunFailure([
      'Test timeout of 8000ms exceeded.',
      '',
      'Error: expect(locator).toBeVisible() failed',
      '',
      'Locator: getByTestId(\'nunca-aparece\')',
      'Expected: visible',
      'Error: element(s) not found'
    ].join('\n'))

    expect(failure!.summary).toBe('O cenário passou de 8s no total, esperando por nunca-aparece.')
  })

  it('devolve a primeira linha do erro que não sabe traduzir', () => {
    const failure = describeRunFailure('Error: algo bem exótico aconteceu\nna segunda linha')

    expect(failure.summary).toBe('algo bem exótico aconteceu')
    expect(failure.hint).toBeNull()
  })

  it('não inventa mensagem para execução sem erro', () => {
    expect(describeRunFailure(null)).toBeNull()
  })
})
