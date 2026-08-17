import { describe, expect, it } from 'vitest'
import BaseNavbar from '~/components/base/navbar.vue'
import { mountInApp } from '../../support/app'

describe('BaseNavbar', () => {
  it('leva à lista de projetos pelo logo e pelo atalho', async () => {
    const wrapper = await mountInApp(BaseNavbar)

    expect(wrapper.get('[data-testid="navbar-logo"]').attributes('href')).toBe('/')
    expect(wrapper.get('[data-testid="navbar-projetos"]').attributes('href')).toBe('/')
  })

  it('abre a configuração de IA', async () => {
    const wrapper = await mountInApp(BaseNavbar)

    await wrapper.get('[data-testid="navbar-configuracoes"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(document.body.textContent).toContain('Inteligência artificial')
  })

  it('acompanha a configuração de IA quando ela se fecha', async () => {
    const wrapper = await mountInApp(BaseNavbar)

    await wrapper.get('[data-testid="navbar-configuracoes"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))

    const modal = wrapper.findComponent({ name: 'SettingsModal' })

    modal.vm.$emit('update:open', false)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(modal.props('open')).toBe(false)
  })

  it('guarda a cor primária escolhida no cookie', async () => {
    const wrapper = await mountInApp(BaseNavbar)

    await wrapper.get('[data-testid="navbar-cor"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 0))

    const swatch = [...document.body.querySelectorAll<HTMLButtonElement>('[data-testid="cor-emerald"]')].at(-1)!
    swatch.click()

    expect(useAppConfig().ui.colors.primary).toBe('emerald')
  })
})
