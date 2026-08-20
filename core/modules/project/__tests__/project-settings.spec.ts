// @vitest-environment node
/** A URL base do projeto. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let dir: string

const SLUG = 'portal-sistema'

beforeEach(async () => {
  api = await startApi()

  await api.http.post('/api/v1/projects/create/template').send({ name: 'Portal Sistema' }).expect(201)

  dir = api.projectPath(SLUG)
})

afterEach(async () => {
  await api.close()
})

/** O ambiente padrão que o projeto ganha ao nascer. */
function environment(): { name: string, vars: { key: string, value: string, secret: boolean }[] } {
  return JSON.parse(readFileSync(join(dir, 'environments/ambiente.json'), 'utf8'))
}

it('salva a url base que o usuário digitou', async () => {
  const response = await api.http
    .put(`/api/v1/projects/${SLUG}/settings`)
    .send({ baseUrl: 'https://www.univates.br/plataforma' })

  expect(response.status).toBe(200)
  expect(response.body.base_url).toBe('https://www.univates.br/plataforma')

  expect(environment().vars).toContainEqual({
    key: 'URL',
    value: 'https://www.univates.br/plataforma',
    secret: false
  })

  expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('environments')
})

it('mostra a url base salva no projeto', async () => {
  await api.http.put(`/api/v1/projects/${SLUG}/settings`).send({ baseUrl: 'https://app.test' }).expect(200)

  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.status).toBe(200)
  expect(response.body.base_url).toBe('https://app.test')
})

it('não tem url base até alguém informar uma', async () => {
  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.status).toBe(200)
  expect(response.body.base_url).toBeNull()
})

it('preserva as variáveis que o ambiente já tinha', async () => {
  await api.http
    .post(`/api/v1/projects/${SLUG}/auth/credentials`)
    .send({ username: '482910', password: 'segredo' })
    .expect(204)

  await api.http.put(`/api/v1/projects/${SLUG}/settings`).send({ baseUrl: 'https://app.test' }).expect(200)

  expect(environment().vars).toContainEqual({ key: 'AUTH_USER', value: '482910', secret: false })
})

it('substitui uma url base que já estava definida', async () => {
  await api.http.put(`/api/v1/projects/${SLUG}/settings`).send({ baseUrl: 'https://antigo.test' }).expect(200)
  await api.http.put(`/api/v1/projects/${SLUG}/settings`).send({ baseUrl: 'https://novo.test' }).expect(200)

  expect(environment().vars).toContainEqual({ key: 'URL', value: 'https://novo.test', secret: false })
  expect(JSON.stringify(environment())).not.toContain('antigo.test')
})

it('pede a url base enquanto o projeto não tem uma', async () => {
  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.status).toBe(200)
  expect(response.body.requires_url).toBe(true)
})

it('para de pedir assim que a url é preenchida', async () => {
  await api.http.put(`/api/v1/projects/${SLUG}/settings`).send({ baseUrl: 'https://app.test' }).expect(200)

  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.body.requires_url).toBe(false)
})

it('para de pedir quando o usuário escolhe deixar em branco', async () => {
  await api.http.post(`/api/v1/projects/${SLUG}/settings/skip`).expect(204)

  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.status).toBe(200)
  expect(response.body.requires_url).toBe(false)
  expect(response.body.base_url).toBeNull()
})

it('devolve 404 ao dispensar a url de um projeto que não existe', async () => {
  const response = await api.http.post('/api/v1/projects/inexistente/settings/skip')

  expect(response.status).toBe(404)
})

it('valida a url base', async () => {
  const response = await api.http.put(`/api/v1/projects/${SLUG}/settings`).send({ baseUrl: 'nao-e-url' })

  expect(response.status).toBe(422)
  expect(response.body.errors).toHaveProperty('baseUrl')
})

it('devolve 404 para um projeto que não existe', async () => {
  const response = await api.http
    .put('/api/v1/projects/inexistente/settings')
    .send({ baseUrl: 'https://app.test' })

  expect(response.status).toBe(404)
})
