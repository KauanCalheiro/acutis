import { EnvironmentService } from '@acutis/core/modules/environment/environment.service.js'
import { ProjectService } from '@acutis/core/modules/project/project.service.js'
import { EnvironmentUseCases } from '@acutis/core/use-cases/environment/environment.use-cases.js'

const useCases = new EnvironmentUseCases(new EnvironmentService(new ProjectService()))

export function environmentUseCases(): EnvironmentUseCases {
  return useCases
}
