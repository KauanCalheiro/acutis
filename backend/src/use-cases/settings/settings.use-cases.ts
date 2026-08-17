import { Injectable } from '@nestjs/common'
import { SettingsService } from '../../modules/settings/settings.service.js'
import type { AiSettingsDto } from '../../dto/settings/ai-settings.dto.js'
import type { ListModelsDto } from '../../dto/settings/list-models.dto.js'
import type { PingModelDto } from '../../dto/settings/ping-model.dto.js'

@Injectable()
export class SettingsUseCases {
    constructor(private readonly service: SettingsService) {}
    show() { return this.service.show() }
    update(dto: AiSettingsDto) { return this.service.update(dto) }
    availableModels(dto: ListModelsDto) { return this.service.availableModels(dto) }
    ping(dto: PingModelDto) { return this.service.ping(dto) }
}
