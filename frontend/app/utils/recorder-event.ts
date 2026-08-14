import type { RecorderEvent } from '~/composables/webdriver'

/**
 * Como o evento chama o elemento. Mesma ordem de fontes do `SpecEmitter::describe` do backend, e
 * pelo mesmo motivo: seletor CSS não descreve nada a quem lê — sem nome, o passo diz o genérico.
 */
function target(event: RecorderEvent): string | null {
  const selectors = event.selectors
  const source = event.label || event.innerText || selectors?.placeholder || selectors?.text || ''
  const clean = source.replace(/\s+/g, ' ').trim()

  return clean === '' ? null : clean
}

/**
 * O alvo entre aspas: separa o que veio da tela do verbo que o descreve, e assim "Clica em" e o
 * nome do botão não viram uma frase só. Substantivo genérico ("o campo") fica sem aspas de
 * propósito — não é nome de nada.
 */
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
 * A frase que descreve o evento gravado, no mesmo vocabulário dos passos que aparecem ao rodar o
 * teste ("Clica em Entrar", "Preenche Senha") — a timeline de eventos e a de execução contam a
 * mesma história, e ler uma prepara para a outra. Verbo na 3ª pessoa: quem age é o teste, e as duas
 * telas narram o que ele fez, não o que se pede a alguém que faça.
 *
 * A navegação é dita pelo caminho, e não pelo título da página: o título é o mesmo do site inteiro
 * em quase todo lugar, e três "Abrir Intra - UNIVATES" seguidos não dizem para onde se foi.
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
      return `Confere ${what ? quoted(what) : 'o elemento'}`
    default:
      return what ?? event.url ?? event.type ?? ''
  }
}
