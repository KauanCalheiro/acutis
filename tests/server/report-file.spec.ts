// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, defineEventHandler, getRouterParam, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sendReportFile } from '../../server/utils/report-file'

let directory: string

const FILES = [
  'index.html',
  'index.js',
  'index.css',
  'logo.svg',
  'trace.zip',
  'app.webmanifest',
  'leia.txt',
  'arquivo.qualquer'
]

const router = createRouter().get(
  '/report/:file',
  defineEventHandler(event => sendReportFile(event, join(directory, getRouterParam(event, 'file') ?? '')))
)
const fetchApp = toWebHandler(createApp().use(router))

/** O arquivo já lido por inteiro, para o diretório temporário poder sumir na sequência. */
async function get(file: string) {
  const response = await fetchApp(new Request(`http://localhost/report/${file}`))

  return {
    status: response.status,
    type: response.headers.get('content-type'),
    body: await response.text()
  }
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'acutis-report-'))
  for (const file of FILES) writeFileSync(join(directory, file), 'conteúdo')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('sendReportFile', () => {
  it('entrega o conteúdo do arquivo pedido', async () => {
    const response = await get('index.html')

    expect(response.status).toBe(200)
    expect(response.body).toBe('conteúdo')
  })

  it('anuncia o html do relatório como página, não como download', async () => {
    expect((await get('index.html')).type).toBe('text/html; charset=utf-8')
  })

  /** Sem o tipo certo o Chrome recusa o módulo e o visualizador de trace fica em branco. */
  it('anuncia o script como javascript', async () => {
    expect((await get('index.js')).type).toBe('text/javascript; charset=utf-8')
  })

  it('anuncia a folha de estilo como css', async () => {
    expect((await get('index.css')).type).toBe('text/css; charset=utf-8')
  })

  it('anuncia a imagem como svg', async () => {
    expect((await get('logo.svg')).type).toBe('image/svg+xml')
  })

  it('anuncia o manifesto como manifesto', async () => {
    expect((await get('app.webmanifest')).type).toBe('application/manifest+json')
  })

  it('anuncia o trace como zip, que é o que o visualizador baixa', async () => {
    expect((await get('trace.zip')).type).toBe('application/zip')
  })

  it('anuncia texto puro como texto', async () => {
    expect((await get('leia.txt')).type).toBe('text/plain; charset=utf-8')
  })

  it('cai em binário genérico quando não conhece a extensão', async () => {
    expect((await get('arquivo.qualquer')).type).toBe('application/octet-stream')
  })
})
