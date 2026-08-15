/**
 * A configuração do acutis, lida a cada chamada.
 *
 * Ler a cada vez, e não uma só na subida, é o que permite ao teste apontar os projetos para um
 * diretório temporário sem reiniciar o servidor.
 */
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

export interface Acutis {
    /** Diretório raiz onde os projetos são criados. */
    root: string
    /** A mesma raiz vista do host, para links `vscode://file/`. Cai no `root` quando não há env. */
    hostRoot: string
    /** O git a usar. O app empacotado aponta o que veio no bundle; fora dele, o do PATH. */
    git: string
}

/**
 * O caminho atravessa fronteiras de processo, e um relativo apontaria para lugar nenhum do outro
 * lado.
 */
function toAbsolutePath(path: string): string {
    return isAbsolute(path) ? path : resolve(process.cwd(), path)
}

export function acutis(): Acutis {
    const root = toAbsolutePath(process.env.ACUTIS_PROJECTS_PATH || resolve(homedir(), '.acutis'))

    return {
        root,
        hostRoot: process.env.ACUTIS_PROJECTS_HOST_PATH || root,
        git: process.env.ACUTIS_GIT_BIN || 'git'
    }
}
