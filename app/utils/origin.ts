import type { Project } from '~/types/project'

const providers = {
  github: {
    label: 'GitHub',
    icon: 'i-simple-icons-github'
  },
  gitlab: {
    label: 'GitLab',
    icon: 'i-simple-icons-gitlab'
  }
} as const

export function projectOrigin(project: Pick<Project, 'provider' | 'repository'>) {
  if (project.provider) return providers[project.provider]
  if (project.repository) {
    return {
      label: 'Git',
      icon: 'i-simple-icons-git'
    }
  }
  return {
    label: 'Local',
    icon: 'i-ic-round-computer'
  }
}
