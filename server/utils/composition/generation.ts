import { DomainEventBus } from '@acutis/core/common/events/domain-event-bus.js'
import { ScenarioAiService } from '@acutis/core/modules/ai/scenario-ai.service.js'
import { GenerationService } from '@acutis/core/modules/generation/generation.service.js'
import { ProjectService } from '@acutis/core/modules/project/project.service.js'
import { settingsUseCases } from './settings'

export async function generationUseCases() {
  const projects = new ProjectService()
  const settings = await settingsUseCases()

  return {
    generation: new GenerationService(projects, settings, new DomainEventBus()),
    scenarios: new ScenarioAiService(projects, settings)
  }
}
