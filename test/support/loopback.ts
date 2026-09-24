/** O app de teste aberto em 127.0.0.1, com o supertest apontado para ele. */
import { createServer, type RequestListener } from 'node:http'
import type { AddressInfo } from 'node:net'
import supertest from 'supertest'

export interface Loopback {
  http: ReturnType<typeof supertest>
  address: AddressInfo
  close: () => Promise<void>
}

export async function loopback(listener: RequestListener): Promise<Loopback> {
  const server = createServer(listener)

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))

  return {
    http: supertest(server),
    address: server.address() as AddressInfo,
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  }
}
