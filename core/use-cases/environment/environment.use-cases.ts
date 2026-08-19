import type { EnvironmentRequest } from '#shared/contracts/environment'
import type { EnvironmentService } from '../../modules/environment/environment.service.js'

export class EnvironmentUseCases {
  constructor(private readonly service: EnvironmentService) {}
  list(project: string) { return this.service.list(project) }
  create(project: string, name: string) { return this.service.create(project, name) }
  update(project: string, environment: string, dto: EnvironmentRequest) { return this.service.update(project, environment, dto) }
  remove(project: string, environment: string) { return this.service.remove(project, environment) }
  activate(project: string, environment: string) { return this.service.activate(project, environment) }
}
