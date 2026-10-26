import { describe, it, expect, beforeEach } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtState } from 'nuxt/app'
import { createError } from 'h3'
import { FIRST_WALKTHROUGH, useFirstWalkthrough } from '~/composables/first-walkthrough'
import { useWalkthroughSeen } from '~/composables/walkthrough'

const CHAPTER_COUNT = 6

const api = {
  revoked: 0,
  runsFail: false
}

registerEndpoint('/api/demo', {
  method: 'POST',
  handler: () => ({
    name: 'Swag Labs',
    slug: 'swag-labs',
    path: '/home/user/.acutis/swag-labs',
    repository: null,
    provider: null,
    created_at: '2026-01-01T00:00:00+00:00',
    demo: true
  })
})

registerEndpoint('/api/demo', {
  method: 'DELETE',
  handler: () => {
    api.revoked++

    return null
  }
})

registerEndpoint('/api/projects/swag-labs', () => ({
  scenarios: [
    {
      spec: 'tests/adicionar-produto-ao-carrinho.spec.ts'
    }
  ]
}))

registerEndpoint('/api/projects/swag-labs/runs', () => {
  if (api.runsFail) throw createError({ statusCode: 500 })

  return {
    runs: [
      {
        started_at: '2026-10-09T10:00:00.000Z'
      }
    ]
  }
})

function currentPath() {
  return useRouter().currentRoute.value.path
}

async function openChapter(index: number) {
  const first = useFirstWalkthrough()

  await first.begin(async () => {})

  for (let chapter = 0; chapter < index; chapter++) await first.advance()

  return first
}

describe('useFirstWalkthrough', () => {
  beforeEach(async () => {
    clearNuxtState([
      'first-walkthrough-progress',
      'first-walkthrough-creating'
    ])
    useWalkthroughSeen().reset()
    api.revoked = 0
    api.runsFail = false
    await navigateTo('/')
  })

  it('começa pela parte da home', async () => {
    const first = await openChapter(0)

    expect(first.chapter.value).toBe('home')
  })

  it('mostra a parte em que a apresentação está', async () => {
    const first = await openChapter(2)

    expect(first.chapterLabel.value).toBe(`Parte 3 de ${CHAPTER_COUNT}`)
  })

  it('abre a tela do projeto de exemplo depois da home', async () => {
    await openChapter(1)

    expect(currentPath()).toBe('/projects/swag-labs')
  })

  it('abre o primeiro cenário do exemplo', async () => {
    await openChapter(3)

    expect(currentPath()).toBe('/projects/swag-labs/scenarios/adicionar-produto-ao-carrinho')
  })

  it('abre a rodada mais recente na última parte', async () => {
    await openChapter(5)

    expect(currentPath()).toBe(`/projects/swag-labs/report/${Date.parse('2026-10-09T10:00:00.000Z')}`)
  })

  it('remove o exemplo quando a próxima parte não abre', async () => {
    api.runsFail = true

    const first = await openChapter(5)

    expect(api.revoked).toBe(1)
    expect(first.chapter.value).toBeNull()
  })

  it('encerra ao avançar depois da última parte', async () => {
    const first = await openChapter(5)

    await first.advance()

    expect(api.revoked).toBe(1)
  })

  it('volta para a home ao encerrar', async () => {
    const first = await openChapter(2)

    await first.end()

    expect(currentPath()).toBe('/')
  })

  it('marca a apresentação inicial como vista ao encerrar', async () => {
    const first = await openChapter(0)

    await first.end()

    expect(useWalkthroughSeen().seen.value).toContain(FIRST_WALKTHROUGH)
  })

  it('deixa o passo de fechamento de fora das partes do meio', async () => {
    const first = await openChapter(0)

    const steps = first.chapterSteps([
      {
        testid: 'navbar-apresentacao',
        title: 'Pronto para começar',
        body: 'Da página.'
      }
    ])

    expect(steps).toEqual([])
  })

  it('fecha a última parte com o passo de fechamento', async () => {
    const first = await openChapter(5)

    const [closing] = first.chapterSteps([])

    expect(closing?.body).toContain('Swag Labs era só um exemplo')
  })
})
