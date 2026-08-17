// @vitest-environment node
/**
 * A tela de configurações de IA: qual provedor está ativo e o cadastro de cada um.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { canListModels, listModels } from '../../ai/providers/model-catalog.js'
import { isSupported } from '../../ai/providers/provider-model.js'
import { DataSource } from 'typeorm'
import { PROVIDER_NAMES } from '../providers/ai-providers.js'
import { encrypt } from '../providers/crypto.js'
import { SettingsService } from '../settings.service.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { SettingsModule } from '../settings.module.js'

let api: Harness
let previousProvider: string | undefined

beforeEach(async () => {
    previousProvider = process.env.AI_PROVIDER
    delete process.env.AI_PROVIDER

    api = await startApi([SettingsModule])
})

afterEach(async () => {
    await api.close()
    vi.unstubAllGlobals()

    if (previousProvider === undefined) {
        delete process.env.AI_PROVIDER
    } else {
        process.env.AI_PROVIDER = previousProvider
    }
})

/** As configurações lidas fora do HTTP, para conferir o que um agente veria. */
function settings(): SettingsService {
    return api.get<SettingsService>(SettingsService)
}

/** O banco daquele app, para o teste conferir o que ficou gravado. */
function database(): DataSource {
    return api.get<DataSource>(DataSource)
}

it('oferece todos os provedores suportados, com nada configurado ainda', async () => {
    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('gemini')
    expect(response.body.providers).toEqual(['anthropic', 'claude-code', 'gemini', 'ollama', 'openai', 'openrouter'])
})

// A lista oferecida é a mesma que o teste acima confere no endpoint; aqui é o suporte de cada uma.
it('só oferece provedor que o backend consegue chamar', () => {
    for (const provider of PROVIDER_NAMES) {
        expect(isSupported(provider)).toBe(true)
    }
})

/** Instalação antiga pode ter ficado com um provedor que esta versão não chama mais. */
it('trata como sem ia o provedor gravado que saiu da lista', async () => {
    await database().query(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        ['ai.provider', encrypt('deepseek')]
    )

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('')
    expect(response.body.configured).toBe(false)
})

/** O banco cria a linha de cada provedor, então a tela nunca encontra provedor sem cadastro. */
it('nasce com uma linha por provedor, todas vazias', async () => {
    await api.http.get('/api/v1/settings/ai').expect(200)

    const rows = await database().query('SELECT * FROM ai_settings') as { provider: string }[]
    const [ollama] = await database().query('SELECT * FROM ai_settings WHERE provider = ?', ['ollama']) as {
        key: string | null
        url: string | null
    }[]

    expect(rows).toHaveLength(PROVIDER_NAMES.length)
    expect(ollama!.key).toBeNull()
    expect(ollama!.url).toBeNull()
})

it('devolve todas as credenciais, para trocar de provedor preencher o formulário com o que ele tem', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta', model: 'gpt-4o' }).expect(200)

    await api.http
        .put('/api/v1/settings/ai')
        .send({
            provider: 'ollama',
            url: 'http://192.168.0.124:11434',
            model: 'qwen3-coder:30b'
        })
        .expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('ollama')
    expect(response.body.credentials.openai.key).toBe('sk-secreta')
    expect(response.body.credentials.ollama.key).toBeNull()
    expect(response.body.credentials.ollama.url).toBe('http://192.168.0.124:11434')
    expect(response.body.credentials.ollama.model).toBe('qwen3-coder:30b')
})

/** Trocar de provedor e voltar não pode perder a chave do primeiro. */
it('mantém a credencial de um provedor que deixou de ser o ativo', async () => {
    await api.http
        .put('/api/v1/settings/ai')
        .send({ provider: 'openai', key: 'sk-da-openai', model: 'gpt-4o' })
        .expect(200)
    await api.http
        .put('/api/v1/settings/ai')
        .send({ provider: 'anthropic', key: 'sk-da-anthropic', model: 'claude-sonnet-4-5' })
        .expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.credentials.openai.key).toBe('sk-da-openai')
    expect(response.body.credentials.anthropic.key).toBe('sk-da-anthropic')
})

it('guarda a chave cifrada em disco, para ler a linha não bastar', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta', model: 'gpt-4o' }).expect(200)

    const [raw] = await database().query('SELECT key FROM ai_settings WHERE provider = ?', ['openai']) as { key: string }[]

    expect(raw!.key).not.toContain('sk-secreta')

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.body.credentials.openai.key).toBe('sk-secreta')
})

/** A chave volta para a tela, então o campo vazio é uma ordem de apagar, não de manter. */
it('apaga a chave quando o campo volta vazio', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta', model: 'gpt-4o' }).expect(200)

    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: null, model: 'gpt-4o' }).expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.body.credentials.openai.key).toBeNull()
})

it('aplica a credencial do provedor ativo sobre os padrões', async () => {
    await api.http
        .put('/api/v1/settings/ai')
        .send({
            provider: 'ollama',
            url: 'http://192.168.0.124:11434',
            model: 'qwen3-coder:30b'
        })
        .expect(200)

    expect(await settings().resolved()).toMatchObject({
        provider: 'ollama',
        url: 'http://192.168.0.124:11434',
        model: 'qwen3-coder:30b'
    })
})

/** A url em branco não escreve nada, e é assim que o padrão do provedor continua valendo. */
it('não grava url quando o campo ficou vazio', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama', model: 'llama3.1:8b' }).expect(200)

    expect(await settings().resolved()).toMatchObject({
        url: 'http://localhost:11434',
        model: 'llama3.1:8b'
    })
})

it('recusa cadastrar um provedor sem escolher o modelo', async () => {
    const response = await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama' })

    expect(response.status).toBe(422)
    expect(response.body.errors.model).toBeDefined()
})

it('deixa a configuração em paz quando nada foi salvo, para o ambiente continuar valendo', async () => {
    await api.http.get('/api/v1/settings/ai').expect(200)

    expect((await settings().resolved()).provider).toBe('gemini')
})

it('continua respondendo antes de o banco existir, caindo no ambiente', async () => {
    await api.http.get('/api/v1/settings/ai').expect(200)

    await database().query('DROP TABLE ai_settings')
    await database().query('DROP TABLE settings')

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('gemini')
    expect((await settings().resolved()).provider).toBe('gemini')
})

/** A tela mostra este endereço como placeholder: campo vazio deixa de ser adivinhação. */
it('informa ao formulário a url padrão de cada provedor que tem uma', async () => {
    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider_urls.ollama).toBe('http://localhost:11434')
    expect(response.body.provider_urls.anthropic).toBe('https://api.anthropic.com/v1')
})

/** Sem isto o formulário não sabe de quem cobrar a chave, e marcaria o campo obrigatório para todos. */
it('informa ao formulário quais provedores não pedem chave', async () => {
    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.keyless_providers).toEqual(['claude-code', 'ollama'])
})

it('ainda informa a url padrão depois de a salva passar a valer', async () => {
    await api.http
        .put('/api/v1/settings/ai')
        .send({ provider: 'ollama', url: 'http://192.168.0.124:11434', model: 'llama3.1:8b' })
        .expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider_urls.ollama).toBe('http://localhost:11434')
    expect(response.body.credentials.ollama.url).toBe('http://192.168.0.124:11434')
})

it('recusa um provedor que não existe', async () => {
    const response = await api.http
        .put('/api/v1/settings/ai')
        .send({ provider: 'inventado', key: 'sk-secreta', model: 'gpt-4o' })

    expect(response.status).toBe(422)
    expect(response.body.errors.provider).toBeDefined()
})

it('recusa trocar para um provedor que ainda não tem chave', async () => {
    const response = await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', model: 'gpt-4o' })

    expect(response.status).toBe(422)
    expect(response.body.errors.key).toBeDefined()
})

/** Provedor local não tem chave para pedir, e era a validação que travava o cadastro dele. */
it('salva um provedor que não pede chave nenhuma', async () => {
    const response = await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama', model: 'llama3.1:8b' })

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('ollama')
    expect(await settings().activeProvider()).toBe('ollama')
})

/** A tela devolve a chave guardada no campo, então reativar o provedor a reenvia junto. */
it('deixa um provedor que já tem chave voltar a ser o ativo', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta', model: 'gpt-4o' }).expect(200)
    await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama', model: 'llama3.1:8b' }).expect(200)

    const response = await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta', model: 'gpt-4o' })

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('openai')
    expect(response.body.credentials.openai.key).toBe('sk-secreta')
})

it('reporta a ia como configurada enquanto houver provedor ativo', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama', model: 'llama3.1:8b' }).expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.configured).toBe(true)
})

/** "Sem IA" na tela: é este campo que desabilita, no frontend, todo botão que chamaria um agente. */
it('desliga a ia quando o formulário volta sem provedor', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama', model: 'llama3.1:8b' }).expect(200)

    const response = await api.http.put('/api/v1/settings/ai').send({ provider: '' })

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('')
    expect(response.body.configured).toBe(false)
    expect(await settings().activeProvider()).toBe('')
})

/** Desligar não apaga cadastro: religar o provedor não pode pedir a chave de novo. */
it('mantém todas as credenciais depois de a ia ser desligada', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta', model: 'gpt-4o' }).expect(200)

    await api.http.put('/api/v1/settings/ai').send({ provider: '' }).expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.credentials.openai.key).toBe('sk-secreta')
})

/** Instalação nova, antes de alguém abrir a tela: sem AI_PROVIDER no ambiente, a IA nasce desligada. */
it('reporta a ia desligada quando o ambiente também não nomeia provedor', async () => {
    process.env.AI_PROVIDER = ''

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('')
    expect(response.body.configured).toBe(false)
})

it('salva mesmo com uma chave de cifra em base64 herdada de uma instalação antiga', async () => {
    mkdirSync(join(api.root, 'runtime'), { recursive: true })
    writeFileSync(join(api.root, 'runtime/app-key'), 'base64:ng601MGsTEfzZzdFGJY9Az7BQVngrMH/zV4BnHs40nM=')

    const response = await api.http
        .put('/api/v1/settings/ai')
        .send({ provider: 'openai', key: 'sk-secreta', model: 'gpt-4o' })

    expect(response.status).toBe(200)
    expect(response.body.credentials.openai.key).toBe('sk-secreta')
})

/** O provedor responde no lugar da rede de verdade: o teste é do que a tela recebe, não do Ollama. */
function respondWith(body: unknown, ok = true): void {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 401 }))
    )
}

it('lista os modelos que o provedor oferece', async () => {
    respondWith({ models: [{ name: 'qwen3-coder:30b', size: 30_000_000_000 }, { name: 'llama3.1:8b' }] })

    const response = await api.http
        .post('/api/v1/settings/ai/models')
        .send({ provider: 'ollama', url: 'http://192.168.0.124:11434' })

    expect(response.status).toBe(200)
    expect(response.body.map((model: { id: string }) => model.id)).toEqual(['llama3.1:8b', 'qwen3-coder:30b'])
    expect(response.body[1].label).toBe('qwen3-coder:30b · 30.0 GB')
})

/** A tela pergunta antes de salvar, então a chave digitada vem no corpo e vale mais que a guardada. */
it('usa a chave que veio no formulário, ainda não salva', async () => {
    respondWith({ data: [{ id: 'gpt-4o' }] })

    const response = await api.http.post('/api/v1/settings/ai/models').send({ provider: 'openai', key: 'sk-nova' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual([{ id: 'gpt-4o', label: 'gpt-4o' }])

    const [, init] = vi.mocked(fetch).mock.calls[0]

    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-nova')
})

/** Chave errada é 401 e endereço errado é recusa de conexão; a tela precisa dizer qual dos dois foi. */
it('explica por que a listagem falhou em vez de devolver lista vazia', async () => {
    respondWith({ error: 'unauthorized' }, false)

    const response = await api.http.post('/api/v1/settings/ai/models').send({ provider: 'openai', key: 'sk-errada' })

    expect(response.status).toBe(422)
    expect(response.body.errors.provider[0]).toContain('401')
})

it('recusa listar modelos de um provedor que não existe', async () => {
    const response = await api.http.post('/api/v1/settings/ai/models').send({ provider: 'inventado' })

    expect(response.status).toBe(422)
    expect(response.body.errors.provider).toBeDefined()
})

/**
 * O Claude Agent roda o Claude Code da máquina, que já está autenticado: não há chave nem endereço
 * para cadastrar, só o modelo.
 */
it('cadastra o claude agent sem pedir credencial nenhuma', async () => {
    const response = await api.http
        .put('/api/v1/settings/ai')
        .send({ provider: 'claude-code', model: 'claude-sonnet-5' })

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('claude-code')
    expect(await settings().resolved()).toMatchObject({
        provider: 'claude-code',
        key: null,
        model: 'claude-sonnet-5'
    })
})

/** Não há endereço a oferecer: o provedor não fala HTTP. */
it('não anuncia endereço padrão para o claude agent', async () => {
    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider_urls['claude-code']).toBeUndefined()
})

/** O binário não tem catálogo, então a lista é fixa e sai sem tocar na rede. */
it('lista os modelos do claude agent sem chamar a rede', async () => {
    respondWith({ data: [] })

    const response = await api.http.post('/api/v1/settings/ai/models').send({ provider: 'claude-code' })

    expect(response.status).toBe(200)
    expect(response.body.map((model: { id: string }) => model.id)).toContain('claude-sonnet-5')
    expect(response.body.length).toBeGreaterThan(5)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
})

/** Provedor sem catálogo mantém o campo de modelo digitável, com o motivo à mostra. */
it('avisa quando o provedor não oferece lista de modelos', async () => {
    const listing = listModels({ provider: 'bedrock', key: null, url: null, model: null })

    await expect(listing).rejects.toThrow('lista de modelos')
})

/** Hoje todos oferecem; se entrar um sem catálogo, a tela precisa continuar dando conta. */
it('oferece catálogo de modelos para todo provedor da lista', async () => {
    const response = await api.http.get('/api/v1/settings/ai')

    for (const provider of response.body.providers as string[]) {
        expect(canListModels(provider)).toBe(true)
    }
})
