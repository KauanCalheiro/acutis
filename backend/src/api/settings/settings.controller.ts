/**
 * A tela de configurações de IA, no mesmo caminho `/api/v1/*` que o Laravel serve hoje.
 */
import { Body, Controller, Get, Put } from '@nestjs/common'
import { AiSettingsDto } from './dto/ai-settings.dto.js'
import type { AiSettings } from './entities/ai-settings.entity.js'
import { SettingsService } from './settings.service.js'

@Controller('api/v1/settings')
export class SettingsController {
    constructor(private readonly settings: SettingsService) {}

    @Get('ai')
    showAi(): AiSettings {
        return this.settings.show()
    }

    @Put('ai')
    updateAi(@Body() dto: AiSettingsDto): AiSettings {
        return this.settings.update(dto)
    }
}
