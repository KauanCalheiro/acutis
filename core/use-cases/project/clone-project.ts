import type { CloneRequest } from '../../modules/git/git.service.js'
import type { Project } from '../../modules/project/entities/project.entity.js'
import type { ProjectWriter } from '../../modules/project/ports/project-writer.js'

export class CloneProject {
  constructor(private readonly projects: ProjectWriter) {}

  execute(request: CloneRequest): Promise<Project> {
    return this.projects.clone(request)
  }
}
