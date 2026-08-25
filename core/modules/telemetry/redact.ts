/** As chaves cujo valor nunca sai da máquina. */
const SENSITIVE_KEY
  = /([\w-]*(?:password|senha|token|secret|api[_-]?key|key|authorization|bearer))(["']?\s*[:=]\s*)(["']?)(?:Bearer\s+)?[^"'\s,}]+(["']?)/gi

/** Valor de ambiente curto demais para ser segredo, e comum demais para ser trocado sem estragar o texto. */
const SHORTEST_SECRET = 8

const MASK = '[redigido]'

export interface RedactContext {
  home?: string
  env?: Record<string, string | undefined>
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** O texto sem caminho de home, sem valor de chave sensível e sem valor de variável de ambiente. */
export function redact(text: string | undefined, { home, env = {} }: RedactContext): string | undefined {
  if (text === undefined) return undefined

  let safe = text

  if (home !== undefined && home !== '') {
    safe = safe.replaceAll(new RegExp(escapeRegExp(home), 'g'), '~')
  }

  safe = safe.replace(SENSITIVE_KEY, `$1$2$3${MASK}$4`)

  for (const value of Object.values(env)) {
    if (value === undefined || value.length < SHORTEST_SECRET) continue
    safe = safe.replaceAll(value, MASK)
  }

  return safe
}
