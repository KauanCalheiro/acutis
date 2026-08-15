/**
 * Os arquivos que um projeto novo recebe: o `playwright.config.ts` e o `package.json`.
 *
 * Ficam em `stubs/` ao lado do código, e não embutidos como string, porque são arquivos que alguém
 * abre e edita — e um `.ts` dentro de uma string de `.ts` ninguém revisa direito.
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_TEMPLATE = 'playwright-ts'

function stubsRoot(): string {
    // `src/api/config/` → a raiz do backend, onde `stubs/` mora.
    return join(fileURLToPath(new URL('../../../', import.meta.url)), 'stubs')
}

export function templatePath(template: string = DEFAULT_TEMPLATE): string {
    return join(stubsRoot(), template)
}

export function templateFile(file: string, template: string = DEFAULT_TEMPLATE): string {
    return join(templatePath(template), file)
}
