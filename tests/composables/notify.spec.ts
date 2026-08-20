import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useNotify } from '~/composables/notify'

const add = vi.fn()

mockNuxtImport('useToast', () => () => ({ add }))

describe('useNotify', () => {
  it('mostra o sucesso em verde', () => {
    useNotify().success('Projeto criado')

    expect(add).toHaveBeenCalledWith({
      title: 'Projeto criado',
      color: 'success',
      icon: 'i-ic-round-check-circle'
    })
  })

  it('mostra o que o servidor explicou em vermelho', () => {
    useNotify().failure({ data: { data: { message: 'Slug já existe' } } }, 'Não deu')

    expect(add).toHaveBeenLastCalledWith({
      title: 'Slug já existe',
      color: 'error',
      icon: 'i-ic-round-error'
    })
  })

  it('usa o texto de reserva quando o erro não diz nada', () => {
    useNotify().failure(new Error('boom'), 'Não deu')

    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Não deu' }))
  })
})
