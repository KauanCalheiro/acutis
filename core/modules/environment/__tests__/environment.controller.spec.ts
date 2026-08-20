// @vitest-environment node
/**
 * Os ambientes do projeto: cada um com os mesmos nomes de variável e valores próprios, um deles
 * ativo.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Dotenv } from '../../project/providers/dotenv.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { EnvKey } from '../providers/env-key.js'
import { Environments } from '../providers/environments.js'

let api: Harness
let dir: string

const SLUG = 'minha-loja'
const BASE = `/api/v1/projects/${SLUG}/environments`

beforeEach(async () => {
  api = await startApi([])

  dir = api.projectPath(SLUG)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja',
    slug: SLUG,
    created_at: '2026-01-01T00:00:00+00:00',
    version: 1
  }))
})

afterEach(async () => {
  await api.close()
})

interface StoredVar { key: string, value: string, secret: boolean }

/** O ambiente como está gravado no disco, que é o que o git versiona. */
function environment(slug: string): { name: string, vars: StoredVar[] } {
  return JSON.parse(readFileSync(join(dir, `environments/${slug}.json`), 'utf8'))
}

function dotenv(): string {
  const file = join(dir, '.env')

  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

function keys(vars: { key: string }[]): string[] {
  return vars.map(variable => variable.key)
}

it('sempre tem um ambiente, com a url como mínimo', async () => {
  const response = await api.http.get(BASE)

  expect(response.status).toBe(200)
  expect(response.body.active).toBe('ambiente')
  expect(response.body.environments[0].name).toBe('Ambiente')
  expect(response.body.environments[0].vars[0].key).toBe(EnvKey.URL)
})

it('exige usuário e senha assim que o projeto tem autenticação', async () => {
  mkdirSync(join(dir, 'tests'), { recursive: true })
  writeFileSync(join(dir, 'tests/auth.setup.ts'), '// login gravado')

  const response = await api.http.get(BASE)

  expect(response.status).toBe(200)
  expect(keys(response.body.environments[0].vars)).toEqual([EnvKey.URL, EnvKey.USER, EnvKey.PASSWORD])
})

it('marca a senha como secreta ao criá-la', async () => {
  mkdirSync(join(dir, 'tests'), { recursive: true })
  writeFileSync(join(dir, 'tests/auth.setup.ts'), '// login gravado')

  const response = await api.http.get(BASE)

  expect(response.status).toBe(200)
  expect(response.body.environments[0].vars.find((variable: StoredVar) => variable.key === EnvKey.PASSWORD))
    .toMatchObject({ secret: true })
})

it('devolve uma chave obrigatória que o editor tirou', async () => {
  await api.http.get(BASE).expect(200)

  await api.http
    .put(`${BASE}/ambiente`)
    .send({ name: 'Ambiente', vars: [{ key: 'CUPOM_VALIDO', value: 'ABC' }] })
    .expect(200)

  expect(keys(environment('ambiente').vars)).toEqual(expect.arrayContaining([EnvKey.URL, 'CUPOM_VALIDO']))
})

it('cria o ambiente quando as credenciais chegam antes de qualquer um', async () => {
  await api.http
    .post(`/api/v1/projects/${SLUG}/auth/credentials`)
    .send({ username: 'qa@loja.test', password: 'segredo' })
    .expect(204)

  expect(environment('ambiente').vars).toEqual([
    { key: EnvKey.URL, value: '', secret: false },
    { key: EnvKey.USER, value: 'qa@loja.test', secret: false },
    { key: EnvKey.PASSWORD, value: 'segredo', secret: true }
  ])
})

it('cria um ambiente e transforma o nome em slug', async () => {
  const response = await api.http.post(BASE).send({ name: 'Homologação' })

  expect(response.status).toBe(201)
  expect(response.body.slug).toBe('homologacao')
  expect(response.body.name).toBe('Homologação')

  expect(environment('homologacao').name).toBe('Homologação')
  expect(keys(environment('homologacao').vars)).toEqual([EnvKey.URL])
})

it('semeia o primeiro ambiente com o que o projeto já tinha no arquivo de env', async () => {
  writeFileSync(
    join(dir, '.env'),
    `${EnvKey.URL}=https://loja.test\n${EnvKey.USER}=qa@loja.test\n${EnvKey.PASSWORD}=segredo\n`
  )

  await api.http.get(BASE).expect(200)

  expect(environment('ambiente').vars).toEqual([
    { key: EnvKey.URL, value: 'https://loja.test', secret: false },
    { key: EnvKey.USER, value: 'qa@loja.test', secret: false },
    { key: EnvKey.PASSWORD, value: 'segredo', secret: true }
  ])
})

it('semeia os valores apenas no primeiro ambiente', async () => {
  writeFileSync(join(dir, '.env'), `${EnvKey.URL}=https://loja.test\n`)

  await api.http.get(BASE).expect(200)
  await api.http.post(BASE).send({ name: 'Produção' }).expect(201)

  expect(environment('producao').vars).toEqual([{ key: EnvKey.URL, value: '', secret: false }])
})

it('ativa o primeiro ambiente criado', async () => {
  await api.http.get(BASE).expect(200)

  const response = await api.http.get(BASE)

  expect(response.status).toBe(200)
  expect(response.body.active).toBe('ambiente')
})

it('recusa um nome que colide com um ambiente existente', async () => {
  await api.http.post(BASE).send({ name: 'Homologação' }).expect(201)

  const response = await api.http.post(BASE).send({ name: 'homologacao' })

  expect(response.status).toBe(422)
  expect(response.body.errors).toHaveProperty('name')
})

it('salva as variáveis comuns no arquivo versionado', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)

  const response = await api.http.put(`${BASE}/homolog`).send({
    name: 'Homolog',
    vars: [
      { key: EnvKey.URL, value: 'https://homolog.loja.test' },
      { key: EnvKey.USER, value: 'qa@loja.test' }
    ]
  })

  expect(response.status).toBe(200)
  expect(response.body.vars[0].value).toBe('https://homolog.loja.test')

  expect(environment('homolog').vars).toEqual([
    { key: EnvKey.URL, value: 'https://homolog.loja.test', secret: false },
    { key: EnvKey.USER, value: 'qa@loja.test', secret: false }
  ])
})

it('guarda o segredo no arquivo do ambiente, que nunca vai para o git', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)

  const response = await api.http.put(`${BASE}/homolog`).send({
    name: 'Homolog',
    vars: [{ key: EnvKey.PASSWORD, value: 'segredo', secret: true }]
  })

  expect(response.status).toBe(200)
  expect(response.body.vars[0].value).toBe('segredo')

  expect(environment('homolog').vars)
    .toContainEqual({ key: EnvKey.PASSWORD, value: 'segredo', secret: true })
  expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('environments')
})

it('dá a cada ambiente o seu próprio valor para a mesma chave', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)

  await api.http
    .put(`${BASE}/homolog`)
    .send({ name: 'Homolog', vars: [{ key: EnvKey.PASSWORD, value: 'senha-de-homolog', secret: true }] })
    .expect(200)

  await api.http
    .put(`${BASE}/producao`)
    .send({ name: 'Producao', vars: [{ key: EnvKey.PASSWORD, value: 'senha-de-producao', secret: true }] })
    .expect(200)

  expect(environment('homolog').vars[0]!.value).toBe('senha-de-homolog')
  expect(environment('producao').vars[0]!.value).toBe('senha-de-producao')
})

it('acrescenta a chave nova a todos os outros ambientes, com o valor em branco', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)

  await api.http
    .put(`${BASE}/homolog`)
    .send({ name: 'Homolog', vars: [{ key: 'CUPOM_VALIDO', value: 'ABC' }] })
    .expect(200)

  expect(environment('producao').vars).toContainEqual({ key: 'CUPOM_VALIDO', value: '', secret: false })
})

it('remove a chave de todos os outros ambientes', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)

  await api.http.put(`${BASE}/homolog`).send({
    name: 'Homolog',
    vars: [
      { key: EnvKey.URL, value: 'https://homolog.test' },
      { key: 'CUPOM_VALIDO', value: 'ABC' }
    ]
  }).expect(200)

  await api.http
    .put(`${BASE}/homolog`)
    .send({ name: 'Homolog', vars: [{ key: EnvKey.URL, value: 'https://homolog.test' }] })
    .expect(200)

  expect(keys(environment('producao').vars)).toEqual([EnvKey.URL])
})

it('mantém o valor que cada ambiente já tinha ao sincronizar as chaves', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)

  await api.http
    .put(`${BASE}/producao`)
    .send({ name: 'Producao', vars: [{ key: EnvKey.URL, value: 'https://loja.test' }] })
    .expect(200)

  await api.http.put(`${BASE}/homolog`).send({
    name: 'Homolog',
    vars: [
      { key: EnvKey.URL, value: 'https://homolog.test' },
      { key: EnvKey.PASSWORD, value: 'segredo', secret: true }
    ]
  }).expect(200)

  expect(environment('producao').vars).toEqual([
    { key: EnvKey.URL, value: 'https://loja.test', secret: false },
    { key: EnvKey.PASSWORD, value: '', secret: true }
  ])
})

it('nasce com as chaves que os outros ambientes já declaram', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.put(`${BASE}/homolog`).send({
    name: 'Homolog',
    vars: [
      { key: EnvKey.URL, value: 'https://homolog.test' },
      { key: EnvKey.PASSWORD, value: 'segredo', secret: true }
    ]
  }).expect(200)

  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)

  expect(environment('producao').vars).toEqual([
    { key: EnvKey.URL, value: '', secret: false },
    { key: EnvKey.PASSWORD, value: '', secret: true }
  ])
})

it('marca a variável como pendente enquanto ela não tem valor', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http
    .put(`${BASE}/homolog`)
    .send({ name: 'Homolog', vars: [{ key: EnvKey.PASSWORD, value: null, secret: true }] })
    .expect(200)

  const response = await api.http.get(BASE)

  expect(response.status).toBe(200)
  expect(response.body.environments[0].vars[0].pending).toBe(true)
})

it('oferece as chaves conhecidas para o autocompletar', async () => {
  writeFileSync(join(dir, '.env.example'), `${EnvKey.URL}=\nCPF_TESTE=\n`)

  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http
    .put(`${BASE}/homolog`)
    .send({ name: 'Homolog', vars: [{ key: 'CUPOM_VALIDO', value: 'ABC' }] })
    .expect(200)

  const response = await api.http.get(BASE)

  expect(response.status).toBe(200)
  expect(response.body.known_keys).toEqual(
    expect.arrayContaining([EnvKey.URL, 'CPF_TESTE', 'CUPOM_VALIDO'])
  )
})

it('valida as chaves das variáveis', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)

  const response = await api.http
    .put(`${BASE}/homolog`)
    .send({ name: 'Homolog', vars: [{ key: 'chave invalida', value: 'x' }] })

  expect(response.status).toBe(422)
  expect(response.body.errors).toHaveProperty('vars.0.key')
})

it('recusa a mesma chave duas vezes no mesmo ambiente', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)

  const response = await api.http.put(`${BASE}/homolog`).send({
    name: 'Homolog',
    vars: [
      { key: EnvKey.URL, value: 'https://a.test' },
      { key: EnvKey.URL, value: 'https://b.test' }
    ]
  })

  expect(response.status).toBe(422)
  expect(response.body.errors).toHaveProperty('vars.1.key')
})

it('ativa outro ambiente', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)

  const response = await api.http.post(`${BASE}/producao/activate`)

  expect(response.status).toBe(200)
  expect(response.body.slug).toBe('producao')
  expect(dotenv()).toContain(`${EnvKey.ACTIVE_ENVIRONMENT}=producao`)
})

it('cai no primeiro ambiente quando o ativo não existe mais', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)
  writeFileSync(join(dir, '.env'), `${EnvKey.ACTIVE_ENVIRONMENT}=apagado\n`)

  const response = await api.http.get(BASE)

  expect(response.status).toBe(200)
  expect(response.body.active).toBe('ambiente')
})

it('apaga um ambiente e esquece que ele era o ativo', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)
  await api.http.post(`${BASE}/producao/activate`).expect(200)

  await api.http.delete(`${BASE}/producao`).expect(204)

  expect(existsSync(join(dir, 'environments/producao.json'))).toBe(false)
  expect(dotenv()).not.toContain(`${EnvKey.ACTIVE_ENVIRONMENT}=producao`)

  const response = await api.http.get(BASE)

  expect(response.status).toBe(200)
  expect(response.body.active).toBe('ambiente')
})

it('devolve 404 para um ambiente que não existe', async () => {
  await api.http.put(`${BASE}/inexistente`).send({ name: 'X', vars: [] }).expect(404)
  await api.http.delete(`${BASE}/inexistente`).expect(404)
  await api.http.post(`${BASE}/inexistente/activate`).expect(404)
})

it('devolve 404 para um projeto que não existe', async () => {
  await api.http.get('/api/v1/projects/nao-existe/environments').expect(404)
})

it('salva a url base no ambiente ativo', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(`${BASE}/homolog/activate`).expect(200)

  await api.http
    .put(`/api/v1/projects/${SLUG}/settings`)
    .send({ baseUrl: 'https://homolog.loja.test' })
    .expect(200)

  expect(environment('homolog').vars)
    .toContainEqual({ key: EnvKey.URL, value: 'https://homolog.loja.test', secret: false })

  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.status).toBe(200)
  expect(response.body.base_url).toBe('https://homolog.loja.test')
})

it('mostra a url base do ambiente que estiver ativo', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http
    .put(`/api/v1/projects/${SLUG}/settings`)
    .send({ baseUrl: 'https://homolog.loja.test' })
    .expect(200)

  await api.http.post(BASE).send({ name: 'Producao' }).expect(201)
  await api.http.post(`${BASE}/producao/activate`).expect(200)
  await api.http
    .put(`/api/v1/projects/${SLUG}/settings`)
    .send({ baseUrl: 'https://loja.test' })
    .expect(200)

  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.status).toBe(200)
  expect(response.body.base_url).toBe('https://loja.test')
})

it('salva as credenciais no ambiente ativo, com a senha como segredo', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(`${BASE}/homolog/activate`).expect(200)

  await api.http
    .post(`/api/v1/projects/${SLUG}/auth/credentials`)
    .send({ username: 'qa@loja.test', password: 'segredo' })
    .expect(204)

  expect(environment('homolog').vars).toContainEqual({ key: EnvKey.USER, value: 'qa@loja.test', secret: false })
  expect(environment('homolog').vars).toContainEqual({ key: EnvKey.PASSWORD, value: 'segredo', secret: true })
})

it('cai no valor padrão só quando a chave não está no arquivo de env', () => {
  writeFileSync(join(dir, '.env'), `${EnvKey.URL}=https://loja.test\n`)

  const env = new Dotenv(dir)

  expect(env.get(EnvKey.USER)).toBeNull()
  expect(env.get(EnvKey.USER, 'ninguem')).toBe('ninguem')
  expect(env.get(EnvKey.URL, 'https://padrao.test')).toBe('https://loja.test')
})

it('cai no valor padrão quando o ambiente ativo deixa a chave vazia', async () => {
  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http
    .put(`${BASE}/homolog`)
    .send({ name: 'Homolog', vars: [{ key: EnvKey.URL, value: null }] })
    .expect(200)

  const environments = new Environments(dir)

  expect(environments.value(EnvKey.URL)).toBeNull()
  expect(environments.value(EnvKey.URL, 'https://padrao.test')).toBe('https://padrao.test')
})

it('roda contra o ambiente ativo', async () => {
  writeFileSync(join(dir, '.env'), 'CUPOM_VALIDO=ABC\n')

  await api.http.post(BASE).send({ name: 'Homolog' }).expect(201)
  await api.http.post(`${BASE}/homolog/activate`).expect(200)
  await api.http.put(`${BASE}/homolog`).send({
    name: 'Homolog',
    vars: [
      { key: EnvKey.URL, value: 'https://homolog.loja.test' },
      { key: EnvKey.PASSWORD, value: 'segredo', secret: true }
    ]
  }).expect(200)

  expect(new Environments(dir).resolve()).toMatchObject({
    [EnvKey.URL]: 'https://homolog.loja.test',
    [EnvKey.PASSWORD]: 'segredo',
    CUPOM_VALIDO: 'ABC',
    [EnvKey.STORAGE_STATE]: 'storage-state.homolog.json'
  })
})

it('não manda ambiente nenhum para o runner enquanto o projeto não tem nenhum', () => {
  expect(new Environments(dir).resolve()).toEqual({})
})
