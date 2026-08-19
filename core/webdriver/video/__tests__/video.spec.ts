// @vitest-environment node
/** O vídeo da gravação: onde ele fica, como a tela o busca e como ele sai do disco. */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { VIDEOS_DIR } from '../../../config/paths.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { VideoService } from '../video.service.js'

let api: Harness

const SESSION = 'sessao-de-teste'

function service(): VideoService {
  return api.get<VideoService>(VideoService)
}

beforeEach(async () => {
  api = await startApi([])
  await service().ensureDir()
})

afterEach(async () => {
  rmSync(service().path(SESSION), { force: true })
  await api.close()
})

function record(contents = 'webm-de-teste'): string {
  const file = service().path(SESSION)

  writeFileSync(file, contents)

  return file
}

it('guarda o vídeo da sessão como webm na pasta de vídeos', () => {
  expect(service().path(SESSION)).toBe(`${VIDEOS_DIR}/${SESSION}.webm`)
})

it('diz que a sessão não tem vídeo antes de gravar', () => {
  expect(service().exists(SESSION)).toBe(false)
})

it('entrega o vídeo gravado', async () => {
  record()

  const response = await api.http.get(`/recording/${SESSION}`)

  expect(response.status).toBe(200)
  expect(response.body.toString()).toBe('webm-de-teste')
})

it('devolve 404 para sessão sem vídeo', async () => {
  const response = await api.http.get('/recording/nao-existe')

  expect(response.status).toBe(404)
})

it('abre o vídeo como stream para quem for repassá-lo', async () => {
  record('conteudo')

  const stream = service().openStream(SESSION)
  const chunks: Buffer[] = []

  for await (const chunk of stream) chunks.push(chunk as Buffer)

  expect(Buffer.concat(chunks).toString()).toBe('conteudo')
})

it('apaga o vídeo da sessão', async () => {
  const file = record()

  const response = await api.http.delete(`/recording/${SESSION}`)

  expect(response.status).toBe(204)
  expect(existsSync(file)).toBe(false)
})

it('não reclama de apagar vídeo que não existe', async () => {
  const response = await api.http.delete('/recording/nao-existe')

  expect(response.status).toBe(204)
})

it('cria a pasta de vídeos quando ela ainda não existe', async () => {
  await service().ensureDir()
  record('x')

  expect(readFileSync(service().path(SESSION), 'utf8')).toBe('x')
})
