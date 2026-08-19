// @vitest-environment node
/** O rascunho que a gravação vira antes de virar arquivo. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EnvKey } from '../../environment/providers/env-key.js'
import { Environments } from '../../environment/providers/environments.js'
import type { RecordedEvent } from '../../recording/events.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'

/** O dublê do agente que escreve o Gherkin. */
vi.mock('../../ai/agents/gherkin.js', () => ({
  writeGherkin: vi.fn(async () => ({
    gherkin: 'Funcionalidade: Login do Usuário\n  Cenário: entra',
    domain: 'login'
  }))
}))

/** O dublê do agente que nomeia o teste e escolhe as tags. */
vi.mock('../../ai/agents/metadata.js', () => ({
  writeMetadata: vi.fn(async () => ({
    title: 'Login do Usuário',
    fileName: 'login-do-usuario',
    tags: ['@read', '@login']
  }))
}))

let api: Harness
let dir: string

const SLUG = 'portal-sistema'

beforeEach(async () => {
  api = await startApi([])

  await api.http
    .put('/api/v1/settings/ai')
    .send({ provider: 'ollama', model: 'llama3.1:8b' })
    .expect(200)

  await api.http.post('/api/v1/projects/create/template').send({ name: 'Portal Sistema' }).expect(201)

  dir = api.projectPath(SLUG)
})

afterEach(async () => {
  await api.close()
})

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    baseUrl: 'http://127.0.0.1:52346',
    events: [
      { type: 'navigate', timestamp: 1, url: 'http://127.0.0.1:52346/', selectors: null, label: 'Home', value: null },
      { type: 'click', timestamp: 2, url: 'http://127.0.0.1:52346/', selectors: { id: 'go', cssStable: '#go' }, label: 'Ir', value: null }
    ] as RecordedEvent[],
    ...overrides
  }
}

function draft(body: Record<string, unknown> = payload(), slug = SLUG) {
  return api.http.post(`/api/v1/projects/${slug}/tests/draft`).send(body)
}

/** Uma variável no ambiente ativo do projeto, sem passar pelo endpoint de ambientes. */
function declare(key: string, value: string, secret = false): void {
  new Environments(dir).set(key, value, secret)
}

it('devolve um rascunho editável com título, tags, domínio e caminho, sem escrever arquivo', async () => {
  const response = await draft()

  expect(response.status).toBe(200)
  expect(response.body.title).toBe('Login do Usuário')
  expect(response.body.tags).toEqual(['@read', '@login'])
  expect(response.body.domain).toBe('login')
  expect(response.body.path).toBe('login-do-usuario')
  expect(response.body.gherkin).toBe('Funcionalidade: Login do Usuário\n  Cenário: entra')
  expect(response.body.playwright).toContain('test.describe')

  expect(existsSync(join(dir, 'tests/login-do-usuario.spec.ts'))).toBe(false)
  expect(existsSync(join(dir, 'features/login-do-usuario.feature'))).toBe(false)
})

it('sugere um caminho que não colide quando já existe um spec com o mesmo nome', async () => {
  mkdirSync(join(dir, 'tests'), { recursive: true })
  writeFileSync(join(dir, 'tests/login-do-usuario.spec.ts'), 'existente')

  const response = await draft()

  expect(response.status).toBe(200)
  expect(response.body.path).toBe('login-do-usuario-2')
})

it('marca o rascunho como @write quando a gravação altera dados', async () => {
  const body = payload()
    ;(body.events as RecordedEvent[]).push({
    type: 'fill', timestamp: 3, url: 'http://127.0.0.1:52346/', selectors: { id: 'nome' } as never, label: 'Nome', value: 'x'
  })

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.tags).toEqual(['@write', '@login'])
  expect(response.body.playwright).toContain('\'@write\'')
})

it('nunca escreve tags no gherkin', async () => {
  const response = await draft(payload({ isPublic: true }))

  expect(response.status).toBe(200)
  expect(response.body.gherkin).not.toContain('@')
  expect(response.body.playwright).toContain('\'@publico\'')
})

it('dá um prazo maior à espera onde a gravação mostra o usuário aguardando a tela carregar', async () => {
  const body = payload()
  const events = body.events as RecordedEvent[]
  events[1]!.timestamp = events[0]!.timestamp! + 4700

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.playwright).toContain('toBeVisible({ timeout: 15000 })')
})

it('lê da variável um valor digitado que o ambiente já guarda', async () => {
  declare('CUPOM_VALIDO', 'ABC123')

  const body = payload()
    ;(body.events as RecordedEvent[]).push({
    type: 'fill', timestamp: 3, url: 'http://127.0.0.1:52346/', selectors: { cssStable: '#cupom' } as never, label: 'Cupom', value: 'ABC123'
  })

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.playwright).toContain('fill(process.env.CUPOM_VALIDO)')
  expect(response.body.playwright).not.toContain('ABC123')
})

it('nunca deixa o valor de uma variável oculta sair do ambiente', async () => {
  declare(EnvKey.PASSWORD, 'nunca-mande-isso', true)

  const response = await draft()

  expect(response.status).toBe(200)
  expect(JSON.stringify(response.body)).not.toContain('nunca-mande-isso')
})

it('monta toda url a partir da chave de ambiente da url base, em vez de escrever o host', async () => {
  const response = await draft()

  expect(response.status).toBe(200)
  expect(response.body.playwright).toContain(`const base = process.env.${EnvKey.URL}`)
  expect(response.body.playwright).not.toContain('127.0.0.1')
})

it('nunca repete um segmento que a url base já carrega', async () => {
  declare(EnvKey.URL, 'https://sistema.test/intranet')

  const body = payload({ baseUrl: 'https://sistema.test/intranet' })
    ;(body.events as RecordedEvent[])[0]!.url = 'https://sistema.test/intranet/produtos'

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.playwright).toContain('${base}/produtos')
  expect(response.body.playwright).not.toContain('/intranet/produtos')
  expect(response.body.warnings.join('\n')).not.toContain('segmento-repetido')
})

it('tira o caminho da url do ambiente, não da que abriu a gravação', async () => {
  declare(EnvKey.URL, 'https://sistema.test/intranet')

  const body = payload({ baseUrl: 'https://sistema.test' })
    ;(body.events as RecordedEvent[])[0]!.url = 'https://sistema.test/intranet/produtos'

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.playwright).toContain('${base}/produtos')
  expect(response.body.playwright).not.toContain('/intranet/produtos')
})

it('confere a url por padrão do segmento, nunca por igualdade exata', async () => {
  const body = payload()
    ;(body.events as RecordedEvent[]).push({
    type: 'assert',
    timestamp: 3,
    url: 'http://127.0.0.1:52346/entrar',
    selectors: { cssStable: '#titulo' } as never,
    label: 'Entrar',
    value: null,
    assert: { assertType: 'url', expectedValue: 'http://127.0.0.1:52346/entrar' }
  })

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.playwright).toContain('toHaveURL(/entrar/)')
  expect(response.body.warnings.join('\n')).not.toContain('url-exata')
})

it('preenche com a url da gravação a variável de url base que o projeto declarou vazia', async () => {
  expect(new Environments(dir).value(EnvKey.URL)).toBeFalsy()

  const response = await draft()

  expect(response.status).toBe(200)
  expect(response.body.warnings).toEqual([])
})

it('não tem o que avisar quando o spec gerado não quebra nenhuma regra', async () => {
  const response = await draft()

  expect(response.status).toBe(200)
  expect(response.body.warnings).toEqual([])
  expect(response.body.playwright).toContain('test.describe')
})

it('não entra em laço de correção: devolve o spec do emissor com o aviso', async () => {
  declare('SISTEMA', 'produtos')

  const body = payload()
    ;(body.events as RecordedEvent[])[0]!.url = 'http://127.0.0.1:52346/produtos'

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.warnings.join('\n')).toContain('valor-literal')
  expect(response.body.playwright).toContain('${base}/produtos')
})

it('avisa o usuário sobre uma chave declarada sem valor, em vez de tentar corrigi-la', async () => {
  const body = payload()
    ;(body.events as RecordedEvent[]).push({
    type: 'fill', timestamp: 3, url: 'http://127.0.0.1:52346/', selectors: { cssStable: '#token' } as never, label: 'Token', value: '', sensitive: true
  })

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.envVars).toEqual(['TOKEN'])
  expect(response.body.warnings.join('\n')).toContain('env-sem-valor')
  expect(response.body.warnings.join('\n')).toContain('TOKEN')
})

it('aceita a url de execução e mantém o spec lendo a url da variável', async () => {
  const response = await draft(payload({ executionUrl: 'https://homolog.sistema.test' }))

  expect(response.status).toBe(200)
  expect(response.body.playwright).toContain(`process.env.${EnvKey.URL}`)
  expect(response.body.playwright).not.toContain('homolog.sistema.test')
})

it('devolve como aviso, com regra e mensagem, o que iria para o corretor', async () => {
  declare('SISTEMA', 'produtos')

  const body = payload()
    ;(body.events as RecordedEvent[])[0]!.url = 'http://127.0.0.1:52346/produtos'
  ;(body.events as RecordedEvent[])[1]!.html = '<button id="go">Ir</button>'

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.warnings[0]).toMatch(/^valor-literal: .+/)
  expect(Object.keys(response.body).sort()).toEqual(
    ['domain', 'envVars', 'gherkin', 'path', 'playwright', 'tags', 'title', 'warnings']
  )
})

it('nunca executa nada quando a gravação não diz onde rodar o spec', async () => {
  const response = await draft()

  expect(response.status).toBe(200)
  expect(existsSync(join(dir, 'test-results'))).toBe(false)
  expect(existsSync(join(dir, 'results'))).toBe(false)
})

/** Sem corretor o rascunho sai numa passagem só: a mesma gravação devolve sempre o mesmo spec. */
it('produz o rascunho numa passagem só, sem repetir a geração', async () => {
  const first = await draft(payload({ executionUrl: 'https://homolog.sistema.test' }))
  const second = await draft(payload({ executionUrl: 'https://homolog.sistema.test' }))

  expect(first.status).toBe(200)
  expect(second.body).toEqual(first.body)
})

it('usa a saída estruturada da ia como gherkin, domínio e título do spec', async () => {
  const response = await draft()

  expect(response.status).toBe(200)
  expect(response.body.gherkin).toContain('Funcionalidade: Login do Usuário')
  expect(response.body.domain).toBe('login')
  expect(response.body.playwright).toContain('test.describe(\'Login do Usuário\'')
})

it('batiza uma variável com o rótulo do campo de cada valor sensível, na ordem do marcador', async () => {
  const body = payload()
  const events = body.events as RecordedEvent[]
  events.push({ type: 'fill', timestamp: 3, url: 'http://127.0.0.1:52346/', selectors: { cssStable: '#senha' } as never, label: 'Senha do portal', value: 'topsecret123', sensitive: true })
  events.push({ type: 'fill', timestamp: 4, url: 'http://127.0.0.1:52346/', selectors: { cssStable: '#token' } as never, label: 'Token', value: 'abc123token', sensitive: true })

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.envVars).toEqual(['SENHA_DO_PORTAL', 'TOKEN'])
  expect(response.body.playwright).toContain('fill(process.env.SENHA_DO_PORTAL)')
  expect(response.body.playwright).toContain('fill(process.env.TOKEN)')
})

it('mantém um valor sensível fora do arquivo gerado e de toda a resposta', async () => {
  const body = payload()
    ;(body.events as RecordedEvent[]).push({
    type: 'fill', timestamp: 3, url: 'http://127.0.0.1:52346/', selectors: { cssStable: '#senha' } as never, label: 'Senha', value: 'topsecret123', sensitive: true
  })

  const response = await draft(body)

  expect(response.status).toBe(200)
  expect(response.body.playwright).not.toContain('topsecret123')
  expect(JSON.stringify(response.body)).not.toContain('topsecret123')
})

it('devolve 404 ao rascunhar para um projeto que não existe', async () => {
  const response = await draft(payload(), 'inexistente')

  expect(response.status).toBe(404)
})

it('valida a gravação antes de rascunhar', async () => {
  const response = await draft({ events: [] })

  expect(response.status).toBe(422)
  expect(Object.keys(response.body.errors)).toEqual(expect.arrayContaining(['baseUrl', 'events']))
})

it('marca o cenário como público quando ele foi gravado sem sessão', async () => {
  const response = await draft(payload({ isPublic: true }))

  expect(response.status).toBe(200)
  expect(response.body.tags).toEqual(['@read', '@login', '@publico'])
  expect(response.body.playwright).toContain('@publico')
})

it('deixa o cenário autenticado por padrão, sem a tag de público', async () => {
  const response = await draft()

  expect(response.status).toBe(200)
  expect(response.body.tags).toEqual(['@read', '@login'])
  expect(response.body.playwright).not.toContain('@publico')
})

it('rascunha o spec sem gherkin quando não há provedor de ia ativo', async () => {
  await desligaIa()

  const response = await draft()

  expect(response.status).toBe(200)
  expect(response.body.gherkin).toBe('')
  expect(response.body.domain).toBe('')
  expect(response.body.tags).toEqual(['@read'])
  expect(response.body.playwright).toContain('test.describe')
})

/** "Sem IA" é provedor em branco — a mesma escolha que a tela oferece. */
async function desligaIa(): Promise<void> {
  await api.http.put('/api/v1/settings/ai').send({ provider: '' }).expect(200)
}

/** Sem provedor, a tag @publico só tem onde ser carimbada no spec: não há feature para receber. */
it('marca o cenário público só no spec quando não há ia', async () => {
  await desligaIa()

  const response = await draft(payload({ isPublic: true }))

  expect(response.status).toBe(200)
  expect(response.body.gherkin).toBe('')
  expect(response.body.playwright).toContain('@publico')
})
