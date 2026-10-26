import type { Project } from '../../modules/project/entities/project.entity.js'
import type { ProjectWriter } from '../../modules/project/ports/project-writer.js'
import type { ProjectService } from '../../modules/project/project.service.js'

export const DEMO_PROJECT_NAME = 'Swag Labs'

export interface DemoProjectResult {
  project: Project
  created: boolean
}

/** O projeto de exemplo da apresentação inicial: criado uma vez só e revogado sem tocar nos projetos do usuário. */
export class DemoProject {
  constructor(
    private readonly writer: ProjectWriter,
    private readonly projects: ProjectService
  ) {}

  private async demos(): Promise<Project[]> {
    const { data } = await this.projects.findAll()

    return data.filter(project => project.demo)
  }

  async create(): Promise<DemoProjectResult> {
    const [existing] = await this.demos()

    if (existing) {
      return {
        project: existing,
        created: false
      }
    }

    return {
      project: this.writer.createDemo(DEMO_PROJECT_NAME),
      created: true
    }
  }

  async revoke(): Promise<void> {
    for (const demo of await this.demos()) this.projects.remove(demo.slug)
  }
}
