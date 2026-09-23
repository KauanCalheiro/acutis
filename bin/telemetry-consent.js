import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'

const QUESTION = [
  '',
  '  O acutis pode enviar relatos de erro automaticamente para ajudar a corrigir falhas.',
  '  Vai a mensagem do erro, o stack, a versão do acutis e do Node, o sistema e um identificador',
  '  anônimo da instalação. Caminho da sua pasta pessoal, variáveis de ambiente, senhas e chaves',
  '  são removidos antes do envio. Dá para mudar depois apagando ~/.acutis/runtime/telemetry-consent.',
  '',
  '  Enviar relatos de erro? [s/N] '
].join('\n')

const YES = new Set(['s', 'sim', 'y', 'yes'])

/** Pergunta no terminal e devolve o que a pessoa digitou. */
async function askInTerminal(question) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout })

  try {
    return await terminal.question(question)
  } finally {
    terminal.close()
  }
}

function readSaved(file) {
  try {
    const saved = readFileSync(file, 'utf8').trim()

    return saved === 'sim' ? true : saved === 'nao' ? false : undefined
  } catch {
    return undefined
  }
}

/** A decisão da pessoa sobre enviar relatos de erro, perguntada uma vez e guardada em `root`. */
export async function resolveTelemetryConsent({
  root,
  env = process.env,
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  ask = askInTerminal
}) {
  if (env.DO_NOT_TRACK === '1') return false

  const file = join(root, 'runtime/telemetry-consent')
  const saved = readSaved(file)
  if (saved !== undefined) return saved

  if (!interactive) return false

  const accepted = YES.has((await ask(QUESTION)).trim().toLowerCase())

  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, accepted ? 'sim' : 'nao')

  return accepted
}
