// @vitest-environment node
/** O `.env` do projeto e o `.env.example` que o acompanha. */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, it } from 'vitest'
import { Dotenv } from '../providers/dotenv.js'
import { EnvKey } from '../../environment/providers/env-key.js'

let dir: string

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'acutis-dotenv-'))
})

function dotenv(): Dotenv {
    return new Dotenv(dir)
}

function read(file: string): string {
    return existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : ''
}

it('nasce sem variável nenhuma', () => {
    expect(dotenv().all()).toEqual({})
    expect(dotenv().exampleKeys()).toEqual([])
    expect(dotenv().get('URL')).toBeNull()
    expect(dotenv().get('URL', 'https://padrao.test')).toBe('https://padrao.test')
})

it('grava a variável no .env e a chave no exemplo, sem o valor', () => {
    dotenv().set('SENHA', 'segredo')

    expect(read('.env')).toBe('SENHA=segredo\n')
    expect(read('.env.example')).toBe('SENHA=\n')
    expect(dotenv().get('SENHA')).toBe('segredo')
    expect(dotenv().exampleKeys()).toEqual(['SENHA'])
})

it('mantém o .env fora do git', () => {
    dotenv().set('SENHA', 'segredo')

    expect(read('.gitignore')).toContain('.env')
})

it('troca o valor da variável que já existia, no lugar dela', () => {
    dotenv().merge({ URL: 'https://um.test', SENHA: 'segredo' })
    dotenv().merge({ URL: 'https://dois.test' })

    expect(read('.env')).toBe('URL=https://dois.test\nSENHA=segredo\n')
})

it('não leva o ambiente ativo para o exemplo, que é versionado', () => {
    dotenv().merge({ [EnvKey.ACTIVE_ENVIRONMENT]: 'homologacao', URL: 'https://app.test' })

    expect(dotenv().all()[EnvKey.ACTIVE_ENVIRONMENT]).toBe('homologacao')
    expect(dotenv().exampleKeys()).toEqual(['URL'])
})

it('apaga a variável dos dois arquivos', () => {
    dotenv().merge({ URL: 'https://app.test', SENHA: 'segredo' })

    dotenv().remove(['SENHA'])

    expect(read('.env')).toBe('URL=https://app.test\n')
    expect(read('.env.example')).toBe('URL=\n')
})

it('deixa o arquivo vazio quando apaga a última variável', () => {
    dotenv().set('SENHA', 'segredo')

    dotenv().remove(['SENHA'])

    expect(read('.env')).toBe('')
})

it('não reclama de apagar variável de arquivo que não existe', () => {
    dotenv().remove(['SENHA'])

    expect(read('.env')).toBe('')
})

it('preserva comentário e linha em branco do arquivo escrito à mão', () => {
    writeFileSync(join(dir, '.env'), '# o endereço do sistema\n\nURL=https://app.test\n')

    dotenv().set('SENHA', 'segredo')

    expect(read('.env')).toBe('# o endereço do sistema\n\nURL=https://app.test\nSENHA=segredo\n')
    expect(dotenv().all()).toEqual({ URL: 'https://app.test', SENHA: 'segredo' })
})
