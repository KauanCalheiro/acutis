import { existsSync, readFileSync } from 'node:fs'
import { dirname, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { processEnvironment } from './env.js'

/** Os nomes de manifesto que marcam a raiz: o repositório e o pacote publicado. */
const ROOT_NAMES = ['acutis', '@acutis/cli']

/**
 * A raiz medida pelo `bin` antes de subir o servidor.
 *
 * Dentro do bundle do Nitro `import.meta.url` vira um placeholder (`file:///_entry.js`), então a
 * busca começaria na raiz do sistema de arquivos e terminaria no `cwd` de quem chamou o CLI.
 */
export const PACKAGE_ROOT_ENV = 'ACUTIS_PACKAGE_ROOT'

/**
 * A raiz de onde saem reporter, gravador, vídeos e runner.
 *
 * A busca começa neste arquivo — no pacote instalado, `process.argv[1]` e o `cwd` são o projeto de
 * quem chamou o CLI, e apontariam tudo para a pasta errada.
 */
export function packageRoot(starts: string[] = [
  dirname(fileURLToPath(import.meta.url)),
  process.argv[1] ? dirname(resolve(process.argv[1])) : '',
  process.cwd()
]): string {
  const declared = processEnvironment()[PACKAGE_ROOT_ENV]

  if (declared !== undefined && declared !== '') return declared

  for (const start of starts) {
    let current = start
    const filesystemRoot = parse(current).root

    while (current !== filesystemRoot) {
      const manifest = resolve(current, 'package.json')
      if (existsSync(manifest)) {
        try {
          const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }
          if (pkg.name !== undefined && ROOT_NAMES.includes(pkg.name)) return current
        } catch {
          current = dirname(current)
          continue
        }
      }
      current = dirname(current)
    }
  }

  return process.cwd()
}

export const PACKAGE_ROOT = packageRoot()

export const VIDEOS_DIR = resolve(PACKAGE_ROOT, '.tmp/videos')
export const RUNNER_DIR = resolve(PACKAGE_ROOT, '.tmp/runner')
export const STREAM_REPORTER_PATH = resolve(PACKAGE_ROOT, 'reporters/stream-reporter.cjs')
export const RECORDER_BUNDLE_PATH = resolve(PACKAGE_ROOT, 'dist-ui/driver-entry.js')
