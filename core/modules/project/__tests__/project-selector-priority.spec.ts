// @vitest-environment node
/** A ordem de seletores que o projeto guarda para a gravação seguir. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { DEFAULT_SELECTOR_PRIORITY } from '../../recording/selector-priority.js'
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

function manifest(): { selectors?: string[] } {
  return JSON.parse(readFileSync(join(dir, 'acutis.json'), 'utf8'))
}

it('grava no manifesto a ordem que o usuário arrastou', async () => {
  const response = await api.http
    .put(`/api/v1/projects/${SLUG}/selectors`)
    .send({ selectors: ['xpath', 'dataTestId'] })

  expect(response.status).toBe(200)
  expect(response.body.selectors.slice(0, 2)).toEqual(['xpath', 'dataTestId'])
  expect(manifest().selectors!.slice(0, 2)).toEqual(['xpath', 'dataTestId'])
})

it('devolve a ordem completa, com o que não foi arrastado no fim', async () => {
  const response = await api.http
    .put(`/api/v1/projects/${SLUG}/selectors`)
    .send({ selectors: ['xpath'] })

  expect(response.body.selectors).toHaveLength(DEFAULT_SELECTOR_PRIORITY.length)
  expect([...response.body.selectors].sort()).toEqual([...DEFAULT_SELECTOR_PRIORITY].sort())
})

it('recusa o seletor que não existe, dizendo o que houve', async () => {
  const response = await api.http
    .put(`/api/v1/projects/${SLUG}/selectors`)
    .send({ selectors: ['data-inventado'] })

  expect(response.status).toBe(422)
  expect(JSON.stringify(response.body)).toContain('não é um seletor')
})

it('recusa a lista vazia, que deixaria a gravação sem seletor nenhum', async () => {
  const response = await api.http
    .put(`/api/v1/projects/${SLUG}/selectors`)
    .send({ selectors: [] })

  expect(response.status).toBe(422)
})

it('mostra no projeto a ordem padrão enquanto ninguém mexeu nela', async () => {
  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.body.selectors).toEqual(DEFAULT_SELECTOR_PRIORITY)
})

it('mostra no projeto a ordem salva, que é o que a tela reabre', async () => {
  await api.http.put(`/api/v1/projects/${SLUG}/selectors`).send({ selectors: ['xpath'] })

  const response = await api.http.get(`/api/v1/projects/${SLUG}`)

  expect(response.body.selectors[0]).toBe('xpath')
})
