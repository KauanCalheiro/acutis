import type { Project } from '../../modules/project/entities/project.entity.js'
import type { ProjectWriter } from '../../modules/project/ports/project-writer.js'

export class CreateProject {
  constructor(private readonly projects: ProjectWriter) {}

  execute(name: string): Project {
    return this.projects.create(name)
  }
}
