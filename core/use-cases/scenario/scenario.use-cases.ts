import type { ScenarioService } from '../../modules/scenario/scenario.service.js'
import type { UpdateScenarioRequest as UpdateScenarioDto } from '#shared/contracts/scenario'

export class ScenarioUseCases {
  constructor(private readonly service: ScenarioService) {}
  findOne(slug: string, id: string) { return this.service.findOne(slug, id) }
  update(slug: string, id: string, dto: UpdateScenarioDto) { return this.service.update(slug, id, dto) }
  remove(slug: string, id: string) { return this.service.remove(slug, id) }
}
