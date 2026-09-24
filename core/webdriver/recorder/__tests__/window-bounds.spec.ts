// @vitest-environment node
import { expect, it } from 'vitest'
import { windowBoundsFor } from '../window-bounds.js'

const PAGE = { width: 1280, height: 720 }

it('soma a barra do navegador para a página ficar no tamanho pedido', () => {
  const bounds = windowBoundsFor(PAGE, { innerWidth: 1280, innerHeight: 633, outerWidth: 1280, outerHeight: 720 })

  expect(bounds).toEqual({ width: 1280, height: 807 })
})

it('soma também a borda lateral quando a janela tem uma', () => {
  const bounds = windowBoundsFor(PAGE, { innerWidth: 1264, innerHeight: 633, outerWidth: 1280, outerHeight: 720 })

  expect(bounds).toEqual({ width: 1296, height: 807 })
})

it('não mexe na janela quando a página já está no tamanho pedido', () => {
  const bounds = windowBoundsFor(PAGE, { innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 720 })

  expect(bounds).toBeNull()
})
