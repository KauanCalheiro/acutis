// @vitest-environment node
import { createServer } from 'node:http'
import { afterEach, expect, it } from 'vitest'
import { loopback, type Loopback } from '../../test/support/loopback'

let aberto: Loopback | null = null

afterEach(async () => {
  await aberto?.close()
  aberto = null
})

function respondeCom(status: number) {
  return (_request: unknown, response: { writeHead: (code: number) => void, end: () => void }) => {
    response.writeHead(status)
    response.end()
  }
}

it('atende pelo app que recebeu', async () => {
  aberto = await loopback(respondeCom(201))

  expect((await aberto.http.post('/qualquer')).status).toBe(201)
})

it('escuta só em 127.0.0.1, onde o sistema não sorteia porta que outro programa já ocupa', async () => {
  aberto = await loopback(respondeCom(201))

  expect(aberto.address).toMatchObject({ address: '127.0.0.1' })
})

it('não divide a porta com outro programa que escuta em 127.0.0.1', async () => {
  const intruso = createServer(respondeCom(401))
  await new Promise<void>(resolve => intruso.listen(0, '127.0.0.1', resolve))

  try {
    aberto = await loopback(respondeCom(201))
    const { port } = intruso.address() as { port: number }

    expect(aberto.address.port).not.toBe(port)
    expect((await aberto.http.post('/qualquer')).status).toBe(201)
  } finally {
    await new Promise<void>(resolve => intruso.close(() => resolve()))
  }
})

it('libera a porta ao fechar', async () => {
  aberto = await loopback(respondeCom(201))
  const { port } = aberto.address
  await aberto.close()
  aberto = null

  const reaberto = createServer(respondeCom(201))
  await new Promise<void>((resolve, reject) => {
    reaberto.once('error', reject)
    reaberto.listen(port, '127.0.0.1', resolve)
  })

  await new Promise<void>(resolve => reaberto.close(() => resolve()))
})
