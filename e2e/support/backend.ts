/**
 * O backend do E2E.
 *
 * Depois da migração do Laravel para Node, a API vive dentro do mesmo processo que o gravador e o
 * runner — então subir "o backend" é subir o mesmo binário que `support/webdriver.ts` sobe, na mesma
 * porta. Este módulo continua existindo com o nome antigo porque é como os specs o chamam, e porque
 * a distinção ainda faz sentido para quem lê o teste: um spec fala com a API, o outro dirige o
 * gravador.
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WEBDRIVER_URL } from './ports'
import { startWebdriver } from './webdriver'

/** O mesmo endereço do gravador: um processo só serve os dois. */
export const BACKEND_URL = WEBDRIVER_URL

/**
 * Um diretório de projetos só desta execução.
 *
 * Substitui a cópia do banco que o Laravel exigia: no Node o SQLite das configurações fica em
 * `<raiz>/runtime/database.sqlite`, derivado da raiz de projetos — isolar o diretório isola o banco
 * junto, sem variável separada.
 */
export function isolatedProjects(): string {
    return mkdtempSync(join(tmpdir(), 'acutis-e2e-'))
}

/** Sobe o backend na porta do E2E e devolve o stop que espera a porta liberar. */
export async function startBackend(env: Record<string, string> = {}): Promise<() => Promise<void>> {
    return startWebdriver(env)
}
