// @vitest-environment node
/** No Windows o bundle do Nitro avalia este módulo com um `import.meta.url` que não vira caminho. */
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('node:url', async (importOriginal) => {
  const url = await importOriginal<typeof import('node:url')>()

  return {
    ...url,
    fileURLToPath: () => url.fileURLToPath('file:///_entry.js', { windows: true })
  }
})

beforeEach(() => {
  process.env.ACUTIS_PACKAGE_ROOT = ''
  vi.resetModules()
})

it('carrega o módulo quando import.meta.url não vira caminho', async () => {
  await expect(import('../paths.js')).resolves.toHaveProperty('PACKAGE_ROOT')
})

it('usa a raiz que o bin declarou quando import.meta.url não vira caminho', async () => {
  process.env.ACUTIS_PACKAGE_ROOT = '/raiz/do/pacote'

  const { PACKAGE_ROOT } = await import('../paths.js')

  expect(PACKAGE_ROOT).toBe('/raiz/do/pacote')
})
