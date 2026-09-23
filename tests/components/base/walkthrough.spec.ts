import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { UApp } from '#components'
import BaseWalkthrough from '~/components/base/walkthrough.vue'
import type { WalkthroughStep } from '~/composables/walkthrough'
import { useWalkthroughRunning, useWalkthroughSeen } from '~/composables/walkthrough'
import { field, settle } from '../../support/modal'

function step(overrides: Partial<WalkthroughStep> = {}): WalkthroughStep {
  return {
    testid: 'alvo-a',
    title: 'Passo',
    body: 'Explicação do passo',
    ...overrides
  }
}

let mounted: { unmount: () => void } | undefined

/** Monta a apresentação numa tela de mentira que tem os alvos pedidos. */
async function mountWalkthrough(steps: WalkthroughStep[], targets: string[] = ['alvo-a', 'alvo-b', 'alvo-c'], id = 'teste') {
  document.body.innerHTML = ''

  const host = defineComponent({
    setup() {
      return () => h(UApp, null, {
        default: () => [
          ...targets.map(testid => h('button', {
            'data-testid': testid
          }, testid)),
          h(BaseWalkthrough, {
            id,
            steps
          })
        ]
      })
    }
  })

  const root = document.createElement('div')
  document.body.appendChild(root)

  const wrapper = await mountSuspended(host, {
    attachTo: root
  })
  await settle(5)

  mounted = wrapper

  return wrapper
}

function popover() {
  return field('apresentacao')
}

async function click(testid: string) {
  field(testid)!.click()
  await settle(5)
}

describe('BaseWalkthrough', () => {
  beforeEach(() => {
    mounted?.unmount()
    mounted = undefined
    useWalkthroughSeen().reset()
    useWalkthroughRunning().value = false
  })

  it('abre sozinha na primeira visita, no primeiro passo', async () => {
    await mountWalkthrough([
      step({
        title: 'Primeiro'
      }),
      step({
        testid: 'alvo-b',
        title: 'Segundo'
      })
    ])

    expect(popover()?.textContent).toContain('Primeiro')
  })

  it('não abre quando a apresentação já foi vista', async () => {
    useWalkthroughSeen().mark('teste')

    await mountWalkthrough([step()])

    expect(popover()).toBeUndefined()
  })

  it('mostra em que passo a pessoa está', async () => {
    await mountWalkthrough([
      step(),
      step({
        testid: 'alvo-b'
      }),
      step({
        testid: 'alvo-c'
      })
    ])

    expect(field('apresentacao-posicao')?.textContent).toBe('1 de 3')
  })

  it('avança para o próximo passo', async () => {
    await mountWalkthrough([
      step({
        title: 'Primeiro'
      }),
      step({
        testid: 'alvo-b',
        title: 'Segundo'
      })
    ])

    await click('apresentacao-avancar')

    expect(popover()?.textContent).toContain('Segundo')
  })

  it('volta para o passo anterior', async () => {
    await mountWalkthrough([
      step({
        title: 'Primeiro'
      }),
      step({
        testid: 'alvo-b',
        title: 'Segundo'
      })
    ])

    await click('apresentacao-avancar')
    await click('apresentacao-voltar')

    expect(popover()?.textContent).toContain('Primeiro')
  })

  it('não oferece voltar no primeiro passo', async () => {
    await mountWalkthrough([
      step(),
      step({
        testid: 'alvo-b'
      })
    ])

    expect(field('apresentacao-voltar')).toBeUndefined()
  })

  it('troca avançar por concluir no último passo', async () => {
    await mountWalkthrough([step()])

    expect(field('apresentacao-avancar')).toBeUndefined()
    expect(field('apresentacao-concluir')).toBeDefined()
  })

  it('lista os termos que o passo explica', async () => {
    await mountWalkthrough([
      step({
        items: [
          {
            term: 'Sem IA',
            text: 'grava e roda'
          }
        ]
      })
    ])

    expect(popover()?.textContent).toContain('Sem IA')
    expect(popover()?.textContent).toContain('grava e roda')
  })

  it('fecha e marca como vista ao concluir', async () => {
    await mountWalkthrough([step()])

    await click('apresentacao-concluir')

    expect(popover()).toBeUndefined()
    expect(useWalkthroughSeen().seen.value).toContain('teste')
  })

  it('guarda a apresentação vista no cookie', async () => {
    await mountWalkthrough([step()])

    await click('apresentacao-concluir')

    expect(useCookie<string[]>('acutis-walkthrough').value).toContain('teste')
  })

  it('fecha e marca como vista ao pular', async () => {
    await mountWalkthrough([
      step(),
      step({
        testid: 'alvo-b'
      })
    ])

    await click('apresentacao-pular')

    expect(popover()).toBeUndefined()
    expect(useWalkthroughSeen().seen.value).toContain('teste')
  })

  it('fecha e marca como vista pelo Esc', async () => {
    await mountWalkthrough([
      step(),
      step({
        testid: 'alvo-b'
      })
    ])

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape'
    }))
    await settle(5)

    expect(popover()).toBeUndefined()
    expect(useWalkthroughSeen().seen.value).toContain('teste')
  })

  it('deixa de fora o passo cujo alvo não está na tela', async () => {
    await mountWalkthrough([
      step({
        title: 'Primeiro'
      }),
      step({
        testid: 'alvo-sumido',
        title: 'Sumido'
      }),
      step({
        testid: 'alvo-b',
        title: 'Terceiro'
      })
    ])

    expect(field('apresentacao-posicao')?.textContent).toBe('1 de 2')

    await click('apresentacao-avancar')

    expect(popover()?.textContent).toContain('Terceiro')
  })

  it('centraliza o passo sem alvo', async () => {
    await mountWalkthrough([
      step({
        testid: undefined,
        title: 'Boas-vindas'
      })
    ])

    expect(popover()?.textContent).toContain('Boas-vindas')
  })

  it('abre a cena do passo ao entrar nele', async () => {
    const scene = {
      open: vi.fn(),
      close: vi.fn()
    }

    await mountWalkthrough([
      step(),
      step({
        testid: 'alvo-b',
        scene
      })
    ])

    await click('apresentacao-avancar')

    expect(scene.open).toHaveBeenCalledOnce()
  })

  it('mantém a cena aberta entre dois passos dela', async () => {
    const scene = {
      open: vi.fn(),
      close: vi.fn()
    }

    await mountWalkthrough([
      step({
        scene
      }),
      step({
        testid: 'alvo-b',
        scene
      })
    ])

    await click('apresentacao-avancar')

    expect(scene.open).toHaveBeenCalledOnce()
    expect(scene.close).not.toHaveBeenCalled()
  })

  it('fecha a cena ao sair para um passo fora dela', async () => {
    const scene = {
      open: vi.fn(),
      close: vi.fn()
    }

    await mountWalkthrough([
      step({
        scene
      }),
      step({
        testid: 'alvo-b'
      })
    ])

    await click('apresentacao-avancar')

    expect(scene.close).toHaveBeenCalledOnce()
  })

  it('fecha a cena aberta ao pular', async () => {
    const scene = {
      open: vi.fn(),
      close: vi.fn()
    }

    await mountWalkthrough([
      step({
        scene
      }),
      step({
        testid: 'alvo-b'
      })
    ])

    await click('apresentacao-pular')

    expect(scene.close).toHaveBeenCalledOnce()
  })

  it('roda a preparação do passo ao entrar nele', async () => {
    const enter = vi.fn()

    await mountWalkthrough([
      step(),
      step({
        testid: 'alvo-b',
        enter
      })
    ])

    await click('apresentacao-avancar')

    expect(enter).toHaveBeenCalledOnce()
  })

  it('espera o alvo que a cena monta aparecer', async () => {
    const scene = {
      open: () => {
        const late = document.createElement('div')
        late.dataset.testid = 'alvo-tardio'
        setTimeout(() => document.body.appendChild(late), 30)
      },
      close: vi.fn()
    }

    await mountWalkthrough([
      step(),
      step({
        testid: 'alvo-tardio',
        title: 'Dentro do modal',
        scene
      })
    ])

    field('apresentacao-avancar')!.click()
    await new Promise(resolve => setTimeout(resolve, 120))
    await settle(5)

    expect(popover()?.textContent).toContain('Dentro do modal')
  })

  it('avisa que está rodando enquanto aberta', async () => {
    await mountWalkthrough([step()])

    expect(useWalkthroughRunning().value).toBe(true)
  })

  it('avisa que parou de rodar ao concluir', async () => {
    await mountWalkthrough([step()])

    await click('apresentacao-concluir')

    expect(useWalkthroughRunning().value).toBe(false)
  })

  it('reabre quando a pessoa pede para rever as apresentações', async () => {
    await mountWalkthrough([
      step({
        title: 'De novo'
      })
    ])
    await click('apresentacao-concluir')

    useWalkthroughSeen().reset()
    await settle(5)

    expect(popover()?.textContent).toContain('De novo')
  })
})
