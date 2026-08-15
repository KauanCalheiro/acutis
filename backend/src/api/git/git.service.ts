/**
 * O que o acutis faz com repositórios: sondar se dá para acessar e clonar para dentro da pasta de
 * projetos.
 *
 * O clone aceita três formas de acesso, e as três precisam existir porque cobrem casos diferentes:
 * repositório público, token colado na interface, e chave SSH colada na interface. A quarta forma —
 * a credencial que o usuário já tem configurada na máquina — funciona sozinha, porque o processo
 * herda o ambiente dele.
 */
import { Injectable } from '@nestjs/common'
import { Git } from './git.js'

/**
 * `GIT_TERMINAL_PROMPT=0` é o que impede o git de travar pedindo usuário e senha num processo sem
 * terminal: sem isso, sondar um repositório privado penduraria a requisição até o timeout.
 */
const NON_INTERACTIVE = {
    GIT_TERMINAL_PROMPT: '0',
    GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new'
}

@Injectable()
export class GitService {
    /** Se o repositório responde sem pedir credencial — o que a tela chama de "público". */
    async probe(url: string): Promise<boolean> {
        try {
            await Git.client(process.cwd(), NON_INTERACTIVE).listRemote([url])

            return true
        } catch {
            return false
        }
    }
}
