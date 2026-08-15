/**
 * Os arquivos que um projeto novo recebe — o `playwright.config.ts` e o `package.json` —, guardados
 * em `stubs/`.
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DEFAULT_TEMPLATE = 'playwright-ts'

function stubsRoot(): string {
    // `src/modules/project/providers/` → a raiz do backend, onde `stubs/` mora.
    return join(fileURLToPath(new URL('../../../../', import.meta.url)), 'stubs')
}

export function templatePath(template: string = DEFAULT_TEMPLATE): string {
    return join(stubsRoot(), template)
}

export function templateFile(file: string, template: string = DEFAULT_TEMPLATE): string {
    return join(templatePath(template), file)
}
