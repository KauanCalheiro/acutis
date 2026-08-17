/** A configuração do acutis, lida do ambiente a cada chamada. */
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

export interface Acutis {
    /** Diretório raiz onde os projetos são criados. */
    root: string
    /** O git a usar. O app empacotado aponta o que veio no bundle; fora dele, o do PATH. */
    git: string
}

/** O caminho em forma absoluta. */
function toAbsolutePath(path: string): string {
    return isAbsolute(path) ? path : resolve(process.cwd(), path)
}

export function acutis(): Acutis {
    const root = toAbsolutePath(process.env.ACUTIS_PROJECTS_PATH || resolve(homedir(), '.acutis'))

    return {
        root,
        git: process.env.ACUTIS_GIT_BIN || 'git'
    }
}
