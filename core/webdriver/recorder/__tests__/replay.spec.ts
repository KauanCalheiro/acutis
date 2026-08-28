// @vitest-environment node
/** Os passos que o navegador refaz para a gravação continuar de onde o usuário parou. */
import { describe, expect, it } from 'vitest'
import type { RecordingEvent } from '../../../common/types/recording.js'
import { replaySteps } from '../replay.js'

function event(partial: Partial<RecordingEvent>): RecordingEvent {
  return {
    type: 'click',
    timestamp: 1000,
    url: 'http://loja.test',
    selectors: null,
    label: null,
    value: null,
    sensitive: false,
    tagName: null,
    innerText: null,
    inputType: null,
    checked: null,
    html: null,
    ...partial
  } as RecordingEvent
}

function selectors(partial: Record<string, string>) {
  return partial as unknown as RecordingEvent['selectors']
}

describe('replaySteps', () => {
  it('refaz navegação, preenchimento e clique na ordem gravada', () => {
    const steps = replaySteps([
      event({ type: 'navigate', url: 'http://loja.test/login' }),
      event({ type: 'fill', value: 'ana@loja.test', selectors: selectors({ id: 'email' }) }),
      event({ type: 'click', selectors: selectors({ dataTestId: 'entrar' }) })
    ])

    expect(steps).toEqual([
      { action: 'goto', url: 'http://loja.test/login', label: 'Abre /login', at: 0 },
      { action: 'fill', selector: '[id="email"]', value: 'ana@loja.test', label: 'Preenche o campo', at: 1 },
      { action: 'click', selector: '[data-testid="entrar"]', label: 'Clica no elemento', at: 2 }
    ])
  })

  it('refaz o clique no visível quando o test id se repete em elemento escondido', () => {
    const steps = replaySteps([
      event({ type: 'click', selectors: selectors({ dataTestId: 'salvar', hiddenTwins: true }) })
    ])

    expect(steps[0]).toMatchObject({ selector: '[data-testid="salvar"]:visible' })
  })

  it('guarda de qual evento o passo veio, que é onde a gravação é cortada quando ele falha', () => {
    const steps = replaySteps([
      event({ type: 'navigate', url: 'http://loja.test' }),
      event({ type: 'submit', selectors: selectors({ id: 'form' }) }),
      event({ type: 'click', selectors: selectors({ id: 'btn' }) })
    ])

    expect(steps.map(step => step.at)).toEqual([0, 2])
  })

  it('nomeia o passo pelo que a gravação sabe do elemento, para o aviso de falha', () => {
    const steps = replaySteps([
      event({ type: 'fill', value: 'ana', label: 'E-mail', selectors: selectors({ id: 'email' }) }),
      event({ type: 'click', innerText: 'Entrar', selectors: selectors({ id: 'btn' }) }),
      event({ type: 'click', selectors: selectors({ text: 'Sair' }) }),
      event({ type: 'navigate', url: 'http://loja.test' })
    ])

    expect(steps.map(step => step.label)).toEqual([
      'Preenche "E-mail"',
      'Clica em "Entrar"',
      'Clica em "Sair"',
      'Abre /'
    ])
  })

  it('nomeia pelo placeholder e corta o nome comprido, como o spec emitido', () => {
    const steps = replaySteps([
      event({ type: 'fill', value: 'ana', selectors: selectors({ id: 'email', placeholder: 'E-mail' }) }),
      event({ type: 'click', innerText: 'Cursando 2026B Cidades Inteligentes Edson Moacir Ahlert e mais', selectors: selectors({ id: 'card' }) })
    ])

    expect(steps.map(step => step.label)).toEqual([
      'Preenche "E-mail"',
      'Clica em "Cursando 2026B Cidades Inteligentes Edson Moacir Ahlert e ma"'
    ])
  })

  it('escolhe o seletor mais estável que o evento gravou', () => {
    const steps = replaySteps([
      event({ selectors: selectors({ dataTestId: 'entrar', cssStable: '.btn' }) }),
      event({ selectors: selectors({ cssStable: '.btn', text: 'Entrar' }) }),
      event({ selectors: selectors({ ariaLabel: 'Fechar' }) }),
      event({ selectors: selectors({ placeholder: 'E-mail' }) }),
      event({ selectors: selectors({ text: 'Entrar' }) }),
      event({ selectors: selectors({ xpath: '//button[1]' }) })
    ])

    expect(steps.map(step => 'selector' in step ? step.selector : null)).toEqual([
      '[data-testid="entrar"]',
      '.btn',
      '[aria-label="Fechar"]',
      '[placeholder="E-mail"]',
      'text="Entrar"',
      'xpath=//button[1]'
    ])
  })

  it('prefere atributos semânticos ao id que pode ter sido gerado pelo framework', () => {
    const steps = replaySteps([
      event({ selectors: selectors({ id: 'v-0', cssStable: '#v-0', ariaLabel: 'Fechar' }) })
    ])

    expect(steps[0]).toMatchObject({ selector: '[aria-label="Fechar"]' })
  })

  it('deixa de fora o que não se refaz sem inventar estado', () => {
    const steps = replaySteps([
      event({ type: 'submit', selectors: selectors({ id: 'form' }) }),
      event({ type: 'hover', selectors: selectors({ id: 'menu' }) }),
      event({ type: 'assert', selectors: selectors({ id: 'total' }) }),
      event({ type: 'click', selectors: null }),
      event({ type: 'navigate', url: '' }),
      event({ type: 'fill', value: '••••', selectors: selectors({ id: 'senha' }) }),
      event({ type: 'fill', value: '{{SENHA}}', selectors: selectors({ id: 'senha' }) })
    ])

    expect(steps).toEqual([])
  })

  it('escapa a aspa do valor do seletor, que quebraria o atributo', () => {
    const steps = replaySteps([
      event({ selectors: selectors({ dataTestId: 'diz "oi"' }) })
    ])

    expect(steps).toEqual([
      { action: 'click', selector: '[data-testid="diz \\"oi\\""]', label: 'Clica no elemento', at: 0 }
    ])
  })
})
