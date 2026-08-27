/** A falha do Playwright dita em português, com o próximo passo quando ele é conhecido. */
export interface RunFailure {
  summary: string
  hint: string | null
}

const REGRAVAR = 'O seletor veio de uma gravação antiga. Regravar o passo costuma resolver, porque a captura hoje prefere data-testid.'
const AMBIENTE = 'Confira a URL do ambiente ativo em Ambientes, e se o sistema está no ar.'
const TESTID = 'Peça um data-testid para esse elemento no sistema testado: é o único seletor que não depende de posição nem de estilo.'
const ESCONDIDO = 'O elemento existe, então o seletor está certo. Falta o passo anterior que o revela, como abrir o modal ou a aba.'

const LOCATOR = /^Locator:\s*(.+)$/m
const TIMEOUT = /^Timeout:\s*(\d+)ms$/m
const NOT_FOUND = /element\(s\) not found/
const NAVIGATION = /page\.goto: (net::[A-Z_]+) at (\S+)/
const STRICT = /strict mode violation: (.+?) resolved to (\d+) elements/
const TEST_TIMEOUT = /Test timeout of (\d+)ms exceeded/
const ACTION_TIMEOUT = /locator\.(\w+): Timeout (\d+)ms exceeded/
const WAITING_FOR = /waiting for (.+)$/m
const EXPECTED_STRING = /^Expected(?: string)?:\s*(".*")$/m
const RECEIVED_STRING = /^Received(?: string)?:\s*(".*")$/m

const NETWORK_REASONS: Record<string, string> = {
  'net::ERR_NAME_NOT_RESOLVED': 'o domínio não existe',
  'net::ERR_CONNECTION_REFUSED': 'nada está escutando nesse endereço',
  'net::ERR_CONNECTION_TIMED_OUT': 'a conexão expirou',
  'net::ERR_CERT_AUTHORITY_INVALID': 'o certificado não é confiável',
  'net::ERR_INTERNET_DISCONNECTED': 'a máquina está sem rede'
}

const ACTIONS: Record<string, string> = {
  click: 'clicar em',
  fill: 'preencher',
  check: 'marcar',
  uncheck: 'desmarcar',
  press: 'digitar em',
  hover: 'passar o mouse por',
  selectOption: 'escolher a opção de'
}

function seconds(ms: string): string {
  return `${Number(ms) / 1000}s`
}

/** O que o usuário reconhece do locator: o texto, o testid ou o seletor cru, sem o embrulho. */
function readable(locator: string): string {
  const inner = locator.match(/^(?:getBy\w+|locator)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/)

  return (inner?.[2] ?? locator).trim()
}

function firstLine(error: string): string {
  const line = error.split('\n').find(text => text.trim())?.trim() ?? ''

  return line.replace(/^(?:TimeoutError|Error):\s*/, '')
}

export function describeRunFailure(error: string | null | undefined): RunFailure | null {
  if (!error?.trim()) return null

  const navigation = error.match(NAVIGATION)
  if (navigation) {
    const reason = NETWORK_REASONS[navigation[1]!] ?? 'a navegação falhou'

    return { summary: `O endereço ${navigation[2]} não respondeu: ${reason}.`, hint: AMBIENTE }
  }

  const strict = error.match(STRICT)
  if (strict) {
    return {
      summary: `O seletor ${readable(strict[1]!)} casou ${strict[2]} elementos, então não identifica um só.`,
      hint: TESTID
    }
  }

  const expected = error.match(EXPECTED_STRING)
  const received = error.match(RECEIVED_STRING)
  const locator = error.match(LOCATOR)
  if (expected && received) {
    const what = locator ? readable(locator[1]!) : 'A página'

    return { summary: `${what} mostrava ${received[1]}, e o cenário esperava ${expected[1]}.`, hint: null }
  }

  const test = error.match(TEST_TIMEOUT)
  if (test) {
    const waited = locator ? `, esperando por ${readable(locator[1]!)}` : ' e foi interrompido'

    return {
      summary: `O cenário passou de ${seconds(test[1]!)} no total${waited}.`,
      hint: 'O passo que estiver em vermelho na timeline é onde ele ficou preso.'
    }
  }

  const timeout = error.match(TIMEOUT)
  if (locator && timeout) {
    const what = readable(locator[1]!)

    return NOT_FOUND.test(error)
      ? { summary: `Não achei ${what} na página depois de ${seconds(timeout[1]!)}.`, hint: REGRAVAR }
      : { summary: `${what} está na página, mas continuou escondido por ${seconds(timeout[1]!)}.`, hint: ESCONDIDO }
  }

  const action = error.match(ACTION_TIMEOUT)
  if (action) {
    const verb = ACTIONS[action[1]!] ?? `usar (${action[1]})`
    const target = error.match(WAITING_FOR)
    const what = target ? readable(target[1]!) : 'o elemento'

    return {
      summary: `Não consegui ${verb} ${what}: o elemento não ficou pronto em ${seconds(action[2]!)}.`,
      hint: REGRAVAR
    }
  }

  return { summary: firstLine(error), hint: null }
}
