/** As regras que valem para qualquer arquivo Playwright gerado, de cenário ou de login. */
import { EnvKey, ownsKey } from '../environment/providers/env-key.js'
import type { ActiveVars } from '../../common/playwright/active-vars.js'
import type { Playwright } from '../../common/playwright/playwright.js'
import type { Url } from '../../common/playwright/url.js'
import { MASK } from '../recording/recording.js'
import { violation, type Violation } from './violation.js'

export type Rule = (file: Playwright, base: Url, environments: ActiveVars) => Violation[]

/** O host escrito no arquivo prende o teste a um ambiente. */
const host: Rule = (file, base) => {
  if (!file.has(base.host())) return []

  return [violation(
    'host-literal',
    `O host ${base.host()} está escrito no arquivo; monte a URL a partir de process.env.${EnvKey.URL}.`
  )]
}

/** Toda navegação sai da URL base, e nunca de um endereço absoluto escrito no arquivo. */
const scheme: Rule = (file) => {
  if (!file.matches(/https?:\/\//)) return []

  return [violation(
    'url-absoluta',
    `O arquivo monta uma URL absoluta. Toda navegação sai de process.env.${EnvKey.URL}, inclusive a `
    + 'primeira. Sistema com SSO redireciona sozinho para a tela de login e traz o callback de '
    + 'volta; abrir o host do SSO direto perde esse retorno e a sessão não se forma.'
  )]
}

const exactUrl: Rule = (file) => {
  const exact = file.matches(/toHaveURL\s*\(\s*[^/\s)]/)
  const absolute = file.matches(/waitForURL\s*\(\s*['"`][^'"`]*:\/\//)

  if (!exact && !absolute) return []

  return [violation(
    'url-exata',
    'Checagem de URL por igualdade exata; use padrão que contém o caminho, '
    + 'com toHaveURL(/caminho/) e waitForURL(\'**caminho**\').'
  )]
}

const globSegment: Rule = (file) => {
  const loose = file
    .capture(/waitForURL\s*\(\s*['"]([^'"]*)['"]/g)
    .filter(glob => !/^\*\*[^/*]+\*\*$/.test(glob))

  if (loose.length === 0) return []

  return [violation(
    'url-glob-frouxo',
    `O padrão '${loose[0]}' não é um segmento cercado; use '**segmento**' com o último segmento `
    + 'do caminho, sem barra em nenhuma das pontas.'
  )]
}

const trailingSlash: Rule = (file) => {
  if (!file.matches(/toHaveURL\s*\(\s*\/.*\\\/\s*\/[a-z]*\s*\)/)) return []

  return [violation(
    'barra-final',
    'A regex exige a barra final; o caminho vale com e sem ela, então feche em toHaveURL(/segmento/).'
  )]
}

const fixedWait: Rule = (file) => {
  if (!file.matches(/waitForTimeout|setTimeout/)) return []

  return [violation(
    'espera-fixa',
    'Espera de tempo fixo; espere uma condição, com expect(...).toBeVisible() ou waitForURL.'
  )]
}

const repeatedSegment: Rule = (file, base) => {
  const path = base.path()

  if (path === '') return []

  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  if (!file.matches(new RegExp(`(\\}|\\+\\s*['"\`])${escaped}\\b`))) return []

  return [violation(
    'segmento-repetido',
    `A URL base já traz ${path}; o caminho concatenado é só o que sobra depois dela.`
  )]
}

const ALLOWED_IMPORTS = ['@playwright/test']

const foreignImport: Rule = (file) => {
  const foreign = file.imports().filter(from => !ALLOWED_IMPORTS.includes(from))

  if (foreign.length === 0) return []

  return [violation(
    'import-externo',
    `Import de ${foreign.join(', ')}; importe apenas de ${ALLOWED_IMPORTS.join(', ')}.`
  )]
}

const comment: Rule = (file) => {
  if (!file.matches(/(^|\s)(\/\/|\/\*)/m)) return []

  return [violation(
    'comentario-inline',
    'Comentário no arquivo gerado; quem explica o passo é o título do test.step.'
  )]
}

/** Sem await o passo roda em paralelo e a execução quebra. */
const stepAwait: Rule = (file) => {
  const matches = [...file.value.matchAll(/(?:^|[^\w.])((?:await\s+)?)(?:test|setup)\.step\s*\(/gm)]

  if (!matches.some(match => match[1] === '')) return []

  return [violation(
    'step-sem-await',
    'test.step sem await; sem ele o passo roda em paralelo e a execução quebra.'
  )]
}

const ASYNC_ACTIONS = 'goto|click|dblclick|fill|press|check|uncheck|selectOption|hover'
  + '|setInputFiles|waitForURL|waitForSelector|waitForLoadState|storageState|screenshot'

/**
 * Toda ação de página é aguardada.
 *
 * ponytail: checagem por linha; ação quebrada em várias linhas escapa, e aí só a execução real pega.
 */
const actionAwait: Rule = (file) => {
  for (const line of file.lines()) {
    if (new RegExp(`\\.(?:${ASYNC_ACTIONS})\\s*\\(`).test(line) && !line.includes('await')) {
      return [violation('acao-sem-await', `Ação assíncrona sem await: ${line.trim()}`)]
    }
  }

  return []
}

const mask: Rule = (file) => {
  if (!file.has(MASK)) return []

  return [violation(
    'mascara-no-spec',
    `A máscara ${MASK} foi copiada para o arquivo; o valor vem de process.env.<CHAVE>.`
  )]
}

const marker: Rule = (file) => {
  const markers = file.capture(/\{\{([A-Z0-9_]+)\}\}/g)

  if (markers.length === 0) return []

  return [violation(
    'marcador-no-spec',
    `O marcador {{${markers[0]}}} foi copiado para o arquivo; escreva process.env.${markers[0]}.`
  )]
}

const envKeys: Rule = (file, _base, environments) => {
  const violations: Violation[] = []

  for (const key of file.envKeys()) {
    if (environments.has(key)) {
      if (environments.isEmpty(key)) {
        violations.push(violation(
          'env-sem-valor',
          `A variável ${key} está declarada sem valor; preencha o ambiente ou o teste falha.`,
          false
        ))
      }

      continue
    }

    if (ownsKey(key)) continue

    violations.push(violation(
      'env-desconhecida',
      `A variável ${key} não existe no ambiente; use uma das que foram declaradas.`
    ))
  }

  return violations
}

/** Valor curto demais casa por acaso; abaixo disto não dá para afirmar que vazou. */
const SHORT_VALUE = 4

const literalValue: Rule = (file, _base, environments) => {
  const violations: Violation[] = []

  for (const variable of environments.exposed()) {
    const value = variable.value ?? ''

    if (value.length < SHORT_VALUE || !file.has(value)) continue

    violations.push(violation(
      'valor-literal',
      `O valor de ${variable.key} está escrito no arquivo; use process.env.${variable.key}.`
    ))
  }

  return violations
}

const RULES: Rule[] = [
  host,
  scheme,
  exactUrl,
  globSegment,
  trailingSlash,
  fixedWait,
  repeatedSegment,
  foreignImport,
  comment,
  stepAwait,
  actionAwait,
  mask,
  marker,
  envKeys,
  literalValue
]

export function checkSpec(file: Playwright, base: Url, environments: ActiveVars): Violation[] {
  return RULES.flatMap(rule => rule(file, base, environments))
}
