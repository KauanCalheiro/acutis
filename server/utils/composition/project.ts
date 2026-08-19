import { GitService } from '@acutis/core/modules/git/git.service.js'
import { ProjectService } from '@acutis/core/modules/project/project.service.js'
import { FileSystemProjectWriter } from '@acutis/core/modules/project/providers/filesystem-project-writer.js'
import { configureTemplateFiles } from '@acutis/core/modules/project/providers/template.js'
import { GitUseCases } from '@acutis/core/use-cases/git/git.use-cases.js'
import { CloneProject } from '@acutis/core/use-cases/project/clone-project.js'
import { CreateProject } from '@acutis/core/use-cases/project/create-project.js'
import { ProjectUseCases } from '@acutis/core/use-cases/project/project.use-cases.js'
import { Buffer } from 'node:buffer'

const gitService = new GitService()
const projectService = new ProjectService()
const writer = new FileSystemProjectWriter(gitService)

const composition = {
  cloneProject: new CloneProject(writer),
  createProject: new CreateProject(writer),
  git: new GitUseCases(gitService),
  projects: new ProjectUseCases(projectService)
}

export function projectUseCases() {
  return composition
}

let templatesReady = false

export async function prepareProjectTemplates(): Promise<void> {
  if (templatesReady || typeof useStorage !== 'function') return

  const storage = useStorage('assets:templates')
  const files = ['package.json', 'playwright.config.ts']
  const entries = await Promise.all(files.map(async (file) => {
    const raw = await storage.getItemRaw(`playwright-ts/${file}`)
    const content = typeof raw === 'string'
      ? raw
      : raw instanceof Uint8Array
        ? Buffer.from(raw).toString('utf8')
        : null

    return [file, content] as const
  }))

  const missing = entries.find(([, content]) => content === null)
  if (missing) throw new Error(`Arquivo do template não encontrado: ${missing[0]}`)

  configureTemplateFiles(Object.fromEntries(entries) as Record<string, string>)
  templatesReady = true
}
