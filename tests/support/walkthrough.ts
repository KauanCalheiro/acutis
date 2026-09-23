import { expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { Component } from 'vue'
import { UApp } from '#components'
import { field, settle } from './modal'

/** Monta a página dentro do `UApp` e presa ao documento, porque a apresentação procura os alvos nele. */
export async function mountAttached(page: Component, route: string) {
  document.body.innerHTML = ''

  const root = document.createElement('div')
  document.body.appendChild(root)

  const host = defineComponent({
    setup() {
      return () => h(UApp, null, {
        default: () => h(page)
      })
    }
  })

  const wrapper = await mountSuspended(host, {
    route,
    attachTo: root
  })
  await settle(5)

  return wrapper
}

/** O título do passo que a apresentação mostra agora. */
export function walkthroughTitle() {
  return field('apresentacao')?.querySelector('p')?.textContent?.trim()
}

export async function advanceWalkthrough() {
  const before = field('apresentacao-posicao')?.textContent

  field('apresentacao-avancar')!.click()
  await vi.waitFor(() => {
    expect(field('apresentacao-posicao')?.textContent).not.toBe(before)
  })
  await settle(3)
}

/** Percorre a apresentação inteira e devolve o título de cada passo. */
export async function walkthroughTitles() {
  const titles = [walkthroughTitle()]

  while (field('apresentacao-avancar')) {
    await advanceWalkthrough()
    titles.push(walkthroughTitle())
  }

  return titles
}
