import type { RecorderEvent } from '~/composables/webdriver'

/** A gravação como o backend a guarda: os campos do evento, sem o que é do transporte. */
export function toRecordedEvents(events: RecorderEvent[]) {
  return events.map(event => ({
    type: event.type,
    timestamp: event.timestamp,
    url: event.url ?? null,
    selectors: event.selectors ?? null,
    label: event.label ?? null,
    innerText: event.innerText ?? null,
    tagName: event.tagName ?? null,
    inputType: event.inputType ?? null,
    value: event.value ?? null,
    sensitive: event.sensitive ?? false,
    checked: event.checked ?? null,
    html: event.html ?? null,
    assert: event.assert
  }))
}

/** Como o evento chama o elemento, na mesma ordem de fontes do `SpecEmitter` do backend. */
function target(event: RecorderEvent): string | null {
  const selectors = event.selectors
  const source = event.label || event.innerText || selectors?.placeholder || selectors?.text || ''
  const clean = source.replace(/\s+/g, ' ').trim()

  return clean === '' ? null : clean
}

/** O alvo entre aspas, separando o que veio da tela do verbo que o descreve. */
function quoted(what: string): string {
  return `"${what}"`
}

/** O caminho da URL, que é como a execução chama a tela: "/login", ou a página inicial na raiz. */
function page(event: RecorderEvent): string {
  const url = event.url ?? ''

  try {
    const path = new URL(url, 'http://base.test').pathname

    return path === '/' ? 'a página inicial' : quoted(path)
  } catch {
    return url ? quoted(url) : 'a página inicial'
  }
}

/**
 * A frase que descreve o evento gravado, no mesmo vocabulário dos passos da execução
 * ("Clica em Entrar", "Preenche Senha"). A navegação é dita pelo caminho da URL.
 */
export function describeRecorderEvent(event: RecorderEvent): string {
  const what = target(event)

  switch (event.type) {
    case 'navigate':
      return `Navega para ${page(event)}`
    case 'click':
      return what ? `Clica em ${quoted(what)}` : 'Clica no elemento'
    case 'hover':
      return what ? `Passa o mouse em ${quoted(what)}` : 'Passa o mouse no elemento'
    case 'fill': {
      const field = what ? quoted(what) : 'o campo'

      if (!event.value) return `Preenche ${field}`

      return `Preenche ${field} com ${event.sensitive ? '••••' : quoted(event.value)}`
    }
    case 'submit':
      return 'Envia o formulário'
    case 'assert':
      if (event.assert?.assertType === 'url') return `Confere que a tela é ${page(event)}`

      return `Confere ${what ? quoted(what) : 'o elemento'}`
    default:
      return what ?? event.url ?? event.type ?? ''
  }
}
