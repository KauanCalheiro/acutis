// @vitest-environment node
/**
 * A tela de configurações de IA: qual provedor está ativo e o cadastro de cada um. Portado de
 * `backend-laravel/tests/Feature/V1/SettingsAiTest.php`.
 *
 * A IA em si está fora do escopo desta versão, mas o cadastro não: é ele que a reativa depois.
 */
import { afterEach, beforeEach, expect, it } from 'vitest'
import { PROVIDER_NAMES } from './ai-providers.js'
import { db } from './database.js'
import { SettingsService } from './settings.service.js'
import { startApi, type Harness } from '../testing/harness.js'
import { SettingsModule } from './settings.module.js'

let api: Harness
let previousProvider: string | undefined

beforeEach(async () => {
    previousProvider = process.env.AI_PROVIDER
    delete process.env.AI_PROVIDER

    // O `ApiModule` ainda não importa o módulo de configurações; a integração é de quem coordena.
    api = await startApi([SettingsModule])
})

afterEach(async () => {
    await api.close()

    if (previousProvider === undefined) {
        delete process.env.AI_PROVIDER
    } else {
        process.env.AI_PROVIDER = previousProvider
    }
})

/** As configurações lidas fora do HTTP, para conferir o que um agente veria. */
function settings(): SettingsService {
    return new SettingsService()
}

it('oferece todos os provedores suportados, com nada configurado ainda', async () => {
    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('gemini')
    expect(response.body.providers).toHaveLength(PROVIDER_NAMES.length)
})

/** O banco cria a linha de cada provedor, então a tela nunca encontra provedor sem cadastro. */
it('nasce com uma linha por provedor, todas vazias', async () => {
    await api.http.get('/api/v1/settings/ai').expect(200)

    const rows = db().prepare('SELECT * FROM ai_settings').all() as { provider: string }[]
    const ollama = db().prepare('SELECT * FROM ai_settings WHERE provider = ?').get('ollama') as {
        key: string | null
        url: string | null
    }

    expect(rows).toHaveLength(PROVIDER_NAMES.length)
    expect(ollama.key).toBeNull()
    expect(ollama.url).toBeNull()
})

it('devolve todas as credenciais, para trocar de provedor preencher o formulário com o que ele tem', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta' }).expect(200)

    await api.http
        .put('/api/v1/settings/ai')
        .send({
            provider: 'ollama',
            url: 'http://192.168.0.124:11434',
            modelCheapest: 'qwen3-coder:30b',
            modelSmartest: 'gemma4:31b'
        })
        .expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('ollama')
    expect(response.body.credentials.openai.key).toBe('sk-secreta')
    expect(response.body.credentials.ollama.key).toBeNull()
    expect(response.body.credentials.ollama.url).toBe('http://192.168.0.124:11434')
    expect(response.body.credentials.ollama.model_cheapest).toBe('qwen3-coder:30b')
    expect(response.body.credentials.ollama.model_smartest).toBe('gemma4:31b')
})

/** Trocar de provedor e voltar não pode perder a chave do primeiro. */
it('mantém a credencial de um provedor que deixou de ser o ativo', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-da-openai' }).expect(200)
    await api.http.put('/api/v1/settings/ai').send({ provider: 'anthropic', key: 'sk-da-anthropic' }).expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.credentials.openai.key).toBe('sk-da-openai')
    expect(response.body.credentials.anthropic.key).toBe('sk-da-anthropic')
})

it('guarda a chave cifrada em disco, para ler a linha não bastar', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta' }).expect(200)

    const raw = db().prepare('SELECT key FROM ai_settings WHERE provider = ?').get('openai') as { key: string }

    expect(raw.key).not.toContain('sk-secreta')

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.body.credentials.openai.key).toBe('sk-secreta')
})

/** A chave volta para a tela, então o campo vazio é uma ordem de apagar, não de manter. */
it('apaga a chave quando o campo volta vazio', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta' }).expect(200)

    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: null }).expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.body.credentials.openai.key).toBeNull()
})

it('aplica a credencial do provedor ativo sobre os padrões', async () => {
    await api.http
        .put('/api/v1/settings/ai')
        .send({
            provider: 'ollama',
            url: 'http://192.168.0.124:11434',
            modelCheapest: 'qwen3-coder:30b',
            modelSmartest: 'gemma4:31b'
        })
        .expect(200)

    expect(settings().resolved()).toMatchObject({
        provider: 'ollama',
        url: 'http://192.168.0.124:11434',
        modelCheapest: 'qwen3-coder:30b',
        modelSmartest: 'gemma4:31b'
    })
})

/** Campo em branco não escreve nada, e é assim que o padrão do provedor continua valendo. */
it('não grava url nem modelo quando os campos ficaram vazios', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama' }).expect(200)

    expect(settings().resolved()).toMatchObject({
        url: 'http://localhost:11434',
        modelCheapest: 'llama3.1:8b',
        modelSmartest: 'llama3.1:8b'
    })
})

it('deixa a configuração em paz quando nada foi salvo, para o ambiente continuar valendo', async () => {
    await api.http.get('/api/v1/settings/ai').expect(200)

    expect(settings().resolved().provider).toBe('gemini')
})

it('continua respondendo antes de o banco existir, caindo no ambiente', async () => {
    await api.http.get('/api/v1/settings/ai').expect(200)

    db().exec('DROP TABLE ai_settings; DROP TABLE settings;')

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('gemini')
    expect(settings().resolved().provider).toBe('gemini')
})

/** A tela mostra este endereço como placeholder: campo vazio deixa de ser adivinhação. */
it('informa ao formulário a url padrão de cada provedor que tem uma', async () => {
    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider_urls.ollama).toBe('http://localhost:11434')
    expect(response.body.provider_urls.anthropic).toBe('https://api.anthropic.com/v1')
})

/**
 * O endereço salvo entra no lugar do padrão para quem for chamar o modelo, e o padrão precisa
 * sobreviver a isso: senão a tela anuncia como padrão justamente o endereço que o usuário gravou.
 */
it('ainda informa a url padrão depois de a salva passar a valer', async () => {
    await api.http
        .put('/api/v1/settings/ai')
        .send({ provider: 'ollama', url: 'http://192.168.0.124:11434' })
        .expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.provider_urls.ollama).toBe('http://localhost:11434')
    expect(response.body.credentials.ollama.url).toBe('http://192.168.0.124:11434')
})

it('recusa um provedor que não existe', async () => {
    const response = await api.http.put('/api/v1/settings/ai').send({ provider: 'inventado', key: 'sk-secreta' })

    expect(response.status).toBe(422)
    expect(response.body.errors.provider).toBeDefined()
})

it('recusa trocar para um provedor que ainda não tem chave', async () => {
    const response = await api.http.put('/api/v1/settings/ai').send({ provider: 'openai' })

    expect(response.status).toBe(422)
    expect(response.body.errors.key).toBeDefined()
})

/** Provedor local não tem chave para pedir, e era a validação que travava o cadastro dele. */
it('salva um provedor que não pede chave nenhuma', async () => {
    const response = await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama' })

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('ollama')
    expect(settings().activeProvider()).toBe('ollama')
})

/** A tela devolve a chave guardada no campo, então reativar o provedor a reenvia junto. */
it('deixa um provedor que já tem chave voltar a ser o ativo', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta' }).expect(200)
    await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama' }).expect(200)

    const response = await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta' })

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('openai')
    expect(response.body.credentials.openai.key).toBe('sk-secreta')
})

it('reporta a ia como configurada enquanto houver provedor ativo', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama' }).expect(200)

    const response = await api.http.get('/api/v1/settings/ai')

    expect(response.status).toBe(200)
    expect(response.body.configured).toBe(true)
})

/** "Sem IA" na tela: é este campo que desabilita, no frontend, todo botão que chamaria um agente. */
it('desliga a ia quando o formulário volta sem provedor', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'ollama' }).expect(200)

    const response = await api.http.put('/api/v1/settings/ai').send({ provider: '' })

    expect(response.status).toBe(200)
    expect(response.body.provider).toBe('')
    expect(response.body.configured).toBe(false)
    expect(settings().activeProvider()).toBe('')
})

/** Desligar não apaga cadastro: religar o provedor não pode pedir a chave de novo. */
it('mantém todas as credenciais depois de a ia ser desligada', async () => {
    await api.http.put('/api/v1/settings/ai').send({ provider: 'openai', key: 'sk-secreta' }).expect(200)

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
