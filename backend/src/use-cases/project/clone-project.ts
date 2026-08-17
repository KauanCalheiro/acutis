import { Injectable } from '@nestjs/common'
import type { CloneRequest } from '../../modules/git/git.service.js'
import type { Project } from '../../modules/project/entities/project.entity.js'
import { ProjectWriter } from '../../modules/project/ports/project-writer.js'

@Injectable()
export class CloneProject {
    constructor(private readonly projects: ProjectWriter) {}

    execute(request: CloneRequest): Promise<Project> {
        return this.projects.clone(request)
    }
}
