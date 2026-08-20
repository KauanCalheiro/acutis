/**
 * Os arquivos que um projeto novo recebe — o `playwright.config.ts` e o `package.json` —, guardados
 * em `stubs/`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_TEMPLATE = 'playwright-ts'

let bundled: Record<string, string> | null = null

export function configureTemplateFiles(files: Record<string, string>): void {
  bundled = files
}

export function hasBundledTemplate(): boolean {
  return bundled !== null
}

export function writeBundledTemplate(path: string): void {
  if (bundled === null) throw new Error(`Template '${DEFAULT_TEMPLATE}' não encontrado.`)

  for (const [file, content] of Object.entries(bundled)) {
    const target = join(path, file)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
}

function stubsRoot(): string {
  // `core/modules/project/providers/` até a raiz do frontend, onde `stubs/` mora.
  return join(fileURLToPath(new URL('../../../../', import.meta.url)), 'stubs')
}

export function templatePath(template: string = DEFAULT_TEMPLATE): string {
  return join(stubsRoot(), template)
}

export function templateFile(file: string, template: string = DEFAULT_TEMPLATE): string {
  return join(templatePath(template), file)
}

export function templateContents(file: string, template: string = DEFAULT_TEMPLATE): string {
  if (bundled !== null && template === DEFAULT_TEMPLATE && bundled[file] !== undefined) {
    return bundled[file]
  }

  return readFileSync(templateFile(file, template), 'utf8')
}
