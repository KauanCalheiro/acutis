/** O backend do E2E: a API vive no mesmo processo que o gravador e o runner. */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WEBDRIVER_URL } from './ports'
import { startWebdriver } from './webdriver'

/** O mesmo endereço do gravador: um processo só serve os dois. */
export const BACKEND_URL = WEBDRIVER_URL

/** Um diretório de projetos só desta execução; o SQLite das configurações vem junto dele. */
export function isolatedProjects(): string {
    return mkdtempSync(join(tmpdir(), 'acutis-e2e-'))
}

/** Sobe o backend na porta do E2E e devolve o stop que espera a porta liberar. */
export async function startBackend(env: Record<string, string> = {}): Promise<() => Promise<void>> {
    return startWebdriver(env)
}
