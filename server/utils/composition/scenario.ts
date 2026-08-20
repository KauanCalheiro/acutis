import { ProjectService } from '@acutis/core/modules/project/project.service.js'
import { ScenarioService } from '@acutis/core/modules/scenario/scenario.service.js'

const scenarios = new ScenarioService(new ProjectService())

export function scenarioUseCases(): ScenarioService {
  return scenarios
}
