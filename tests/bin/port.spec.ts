// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PORT, resolvePort } from '../../bin/port.js'

describe('resolvePort', () => {
  it('serves the app on the default port when it is free', async () => {
    const free = vi.fn().mockResolvedValue(true)

    await expect(resolvePort({ free })).resolves.toBe(DEFAULT_PORT)
    expect(free).toHaveBeenCalledWith(DEFAULT_PORT)
  })

  it('walks to the next port when the preferred one is taken', async () => {
    const free = vi.fn(async (port: number) => port === 1993)

    await expect(resolvePort({ preferred: 1991, free })).resolves.toBe(1993)
  })

  it('honors the port asked for instead of the default', async () => {
    await expect(resolvePort({ preferred: 8080, free: async () => true })).resolves.toBe(8080)
  })

  it('reports the range it swept when every port is taken', async () => {
    await expect(resolvePort({ preferred: 1991, free: async () => false, attempts: 3 }))
      .rejects.toThrow('1991 e 1993')
  })
})
