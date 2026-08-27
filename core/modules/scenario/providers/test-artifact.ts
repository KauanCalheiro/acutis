/**
 * O par de arquivos que um cenário produz: o `.feature` em Gherkin e o `.spec.ts` do Playwright.
 * Lê e reescreve o título, o cenário e as tags de cada um.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const TITLE_LIMIT = 120

export const PATH_LIMIT = 80

/** Corta o texto na próxima cláusula do Gherkin, para o caso da feature vir toda numa linha. */
const NEXT_CLAUSE = /\s+(?:Como|Eu quero|Para|Contexto:|Cen[áa]rio|Esquema do Cen[áa]rio|Dado|Quando|Ent[ãa]o|E)\b/u

/** Corta no limite e apara o espaço que sobra na ponta. */
function limit(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max).trimEnd()
}

function firstClause(line: string): string {
  const clause = line.trim().split(NEXT_CLAUSE)[0]?.trim() ?? ''

  return limit(clause, TITLE_LIMIT)
}

export function title(gherkin: string, fallback = 'teste'): string {
  const match = gherkin.match(/Funcionalidade:\s*(.+)/u)

  return match ? firstClause(match[1]!) : fallback
}

export function scenario(gherkin: string, fallback = 'executa o fluxo gravado'): string {
  const match = gherkin.match(/Cen[áa]rio:\s*(.+)/u)

  return match ? firstClause(match[1]!) : fallback
}

export function tags(gherkin: string): string[] {
  const firstLine = (gherkin.split('\n')[0] ?? '').trim()

  if (!firstLine.startsWith('@')) return []

  return firstLine.match(/@[\w-]+/g) ?? []
}

/** Um nome de arquivo que ainda não existe no diretório, sufixado quando preciso. */
export function uniquePath(dir: string, desired: string): string {
  let candidate = desired
  let suffix = 1

  while (existsSync(join(dir, `${candidate}.spec.ts`))) {
    suffix++
    candidate = `${desired}-${suffix}`
  }

  return candidate
}

export function stampTitle(gherkin: string, newTitle: string): string {
  return gherkin.replace(/Funcionalidade:\s*.+/u, `Funcionalidade: ${newTitle}`)
}

/** Sem `.feature`, o título mora no describe: é de lá que ele é lido e é lá que é regravado. */
export function stampPlaywrightTitle(playwright: string, newTitle: string): string {
  const literal = `'${newTitle.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`

  return playwright.replace(
    /test\.describe(\.skip)?\(\s*(["']).+?\2/u,
    (_match, skip: string | undefined) => `test.describe${skip ?? ''}(${literal}`
  )
}

export function stampGherkinTags(gherkin: string, list: string[]): string {
  const lines = gherkin.split('\n')

  if (lines[0] !== undefined && /^\s*(@[\w-]+\s*)+$/u.test(lines[0])) {
    lines.shift()
  } else if (lines[0] !== undefined && lines[0].trim().startsWith('@')) {
    lines[0] = lines[0].replace(/^\s*(@[\w-]+\s*)+/u, '').trim()
  }

  const body = lines.join('\n')

  return list.length === 0 ? body : `${list.join(' ')}\n${body}`
}

export function stampPlaywrightTags(playwright: string, list: string[]): string {
  if (list.length === 0) return playwright

  const tagList = `tag: [${list.map(tag => `'${tag}'`).join(', ')}]`

  if (/tag:\s*\[[^\]]*\]/.test(playwright)) {
    return playwright.replace(/tag:\s*\[[^\]]*\]/, tagList)
  }

  return playwright.replace(
    /test\.describe(\.skip)?\(\s*((["']).+?\3)\s*,\s*(?=\(|async)/,
    (_match, skip: string | undefined, title: string) => `test.describe${skip ?? ''}(${title}, {${tagList}}, `
  )
}
