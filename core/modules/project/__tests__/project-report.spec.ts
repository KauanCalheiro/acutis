// @vitest-environment node
/** O relatório HTML que a última execução do Playwright deixou no projeto. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let dir: string

beforeEach(async () => {
  api = await startApi()
  dir = api.projectPath('minha-loja')

  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja',
    slug: 'minha-loja',
    created_at: '2026-01-01T00:00:00+00:00',
    version: 1
  }))
})

afterEach(async () => {
  await api.close()
})

function writeReport(): void {
  mkdirSync(join(dir, 'results/report/data'), { recursive: true })
  writeFileSync(join(dir, 'results/report/index.html'), '<html>relatório</html>')
  writeFileSync(join(dir, 'results/report/data/trace.zip'), 'zip-bytes')
}

it('conta na tela do projeto que existe relatório para abrir', async () => {
  writeReport()

  const response = await api.http.get('/api/v1/projects/minha-loja')

  expect(response.status).toBe(200)
  expect(response.body.has_report).toBe(true)
})

it('diz que não há relatório enquanto nada rodou', async () => {
  const response = await api.http.get('/api/v1/projects/minha-loja')

  expect(response.status).toBe(200)
  expect(response.body.has_report).toBe(false)
})

it('entrega o index do relatório da última execução', async () => {
  writeReport()

  const response = await api.http.get('/api/v1/projects/minha-loja/report/')

  expect(response.status).toBe(200)
  expect(response.text).toContain('relatório')
})

it('entrega os arquivos que o relatório carrega, que é de onde vêm vídeo e trace', async () => {
  writeReport()

  const response = await api.http.get('/api/v1/projects/minha-loja/report/data/trace.zip')

  expect(response.status).toBe(200)
})

it('responde 404 enquanto o projeto não tem relatório nenhum', async () => {
  const response = await api.http.get('/api/v1/projects/minha-loja/report/')

  expect(response.status).toBe(404)
})

it('recusa o caminho que sai da pasta do relatório', async () => {
  writeReport()
  writeFileSync(join(dir, 'acutis.json.secret'), 'segredo')

  const response = await api.http.get('/api/v1/projects/minha-loja/report/..%2facutis.json.secret')

  expect(response.status).toBe(404)
})
