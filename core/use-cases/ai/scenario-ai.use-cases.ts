import type { ScenarioAiService } from '../../modules/ai/scenario-ai.service.js'

export class ScenarioAiUseCases {
  constructor(private readonly service: ScenarioAiService) {}
  fix(slug: string, scenario: string) { return this.service.fix(slug, scenario) }
  suggestions(slug: string, scenario: string) { return this.service.suggestions(slug, scenario) }
}
