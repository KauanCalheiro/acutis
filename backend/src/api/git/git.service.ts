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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BadRequest } from '../kernel/errors.js'
import { tokenUrl } from './clone-url.js'
import { Git } from './git.js'

/**
 * `GIT_TERMINAL_PROMPT=0` é o que impede o git de travar pedindo usuário e senha num processo sem
 * terminal: sem isso, sondar um repositório privado penduraria a requisição até o timeout.
 */
const NON_INTERACTIVE = {
    GIT_TERMINAL_PROMPT: '0',
    GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new'
}

export type CloneAuth = 'public' | 'token' | 'ssh_key'

export interface CloneRequest {
    url: string
    name?: string
    branch?: string
    auth?: CloneAuth
    token?: string
    ssh_key?: string
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

    /**
     * Clona para `path`, resolvendo a forma de acesso que o usuário escolheu.
     *
     * O token vai embutido na URL e depois o remote é reescrito sem ele: gravado no `.git/config`,
     * ele vazaria para qualquer um que abrisse o projeto. A chave SSH vira um arquivo temporário
     * com permissão 0600, apagado ao fim — o git só aceita chave por caminho, não por conteúdo.
     */
    async clone(request: CloneRequest, path: string): Promise<void> {
        const auth = request.auth ?? 'public'

        let url = request.url
        let cleanUrl: string | null = null
        let env: Record<string, string> = {}
        let keyFile: string | null = null

        if (auth === 'token' && request.token) {
            url = tokenUrl(request.url, request.token)
            cleanUrl = request.url
        }

        if (auth === 'ssh_key' && request.ssh_key) {
            keyFile = join(mkdtempSync(join(tmpdir(), 'acutis-ssh-')), 'key')
            writeFileSync(keyFile, `${request.ssh_key.trimEnd()}\n`, { mode: 0o600 })
            env = {
                GIT_SSH_COMMAND: `ssh -i ${keyFile} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`
            }
        }

        try {
            const options = request.branch ? ['--branch', request.branch] : []

            await Git.client(process.cwd(), env).clone(url, path, options)

            if (cleanUrl !== null) {
                await Git.client(path).remote(['set-url', 'origin', cleanUrl])
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)

            throw new BadRequest(`Falha ao clonar o repositório: ${message}`)
        } finally {
            if (keyFile !== null) rmSync(keyFile, { force: true })
        }
    }
}
