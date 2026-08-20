// @vitest-environment node
import { expect, it } from 'vitest'

it('embarca no bundle os ícones usados, para o SSR não depender de rede', async () => {
  // O `nuxt.config` roda fora do Nuxt aqui: o macro é global no build, não no teste.
  ;(globalThis as unknown as { defineNuxtConfig: (config: unknown) => unknown }).defineNuxtConfig = config => config

  const config = (await import('../nuxt.config')).default as { icon?: { clientBundle?: { scan?: boolean } } }

  expect(config.icon?.clientBundle?.scan).toBe(true)
})
