import type { SettingsService } from '../../modules/settings/settings.service.js'
import type {
  AiSettingsRequest as AiSettingsDto,
  ListModelsRequest as ListModelsDto,
  PingModelRequest as PingModelDto
} from '#shared/contracts/settings'

export class SettingsUseCases {
  constructor(private readonly service: SettingsService) {}
  show() { return this.service.show() }
  update(dto: AiSettingsDto) { return this.service.update(dto) }
  availableModels(dto: ListModelsDto) { return this.service.availableModels(dto) }
  ping(dto: PingModelDto) { return this.service.ping(dto) }
}
