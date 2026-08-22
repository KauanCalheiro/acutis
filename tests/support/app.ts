import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { Component } from 'vue'
import { UApp } from '#components'

/**
 * Monta o componente dentro do `UApp`, que é onde o Nuxt UI instala os provedores de tooltip,
 * toast e overlay. Sem ele o tooltip quebra no mount.
 */
export function mountInApp<T extends Component>(component: T, options: Record<string, unknown> = {}) {
  const { props = {}, attrs = {}, slots } = options as {
    props?: Record<string, unknown>
    attrs?: Record<string, unknown>
    slots?: Record<string, unknown>
  }

  const host = defineComponent({
    setup() {
      return () => h(UApp, null, {
        default: () => h(component as Component, { ...props, ...attrs }, slots)
      })
    }
  })

  return mountSuspended(host)
}
