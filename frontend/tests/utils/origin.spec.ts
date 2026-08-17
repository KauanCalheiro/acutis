import { describe, expect, it } from 'vitest'
import { projectOrigin } from '~/utils/origin'

describe('projectOrigin', () => {
  it('mostra o provedor quando o projeto veio de um deles', () => {
    expect(projectOrigin({ provider: 'github', repository: 'git@github.com:a/b.git' }).label).toBe('GitHub')
    expect(projectOrigin({ provider: 'gitlab', repository: null }).icon).toBe('i-simple-icons-gitlab')
  })

  it('trata repositório sem provedor conhecido como git genérico', () => {
    expect(projectOrigin({ provider: null, repository: 'https://bitbucket.org/a/b.git' }))
      .toEqual({ label: 'Git', icon: 'i-simple-icons-git' })
  })

  it('trata projeto sem repositório como local', () => {
    expect(projectOrigin({ provider: null, repository: null }).label).toBe('Local')
  })
})
