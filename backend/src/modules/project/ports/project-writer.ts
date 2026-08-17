import type { CloneRequest } from '../../git/git.service.js'
import type { Project } from '../entities/project.entity.js'

export abstract class ProjectWriter {
    abstract create(name: string): Project
    abstract clone(request: CloneRequest): Promise<Project>
}
