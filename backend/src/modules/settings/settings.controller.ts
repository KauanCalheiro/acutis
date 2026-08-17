/** Os endpoints da tela de configurações de IA. */
import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common'
import type { AvailableModel } from '../ai/providers/model-catalog.js'
import { AiSettingsDto } from './dto/ai-settings.dto.js'
import { ListModelsDto } from './dto/list-models.dto.js'
import { PingModelDto } from './dto/ping-model.dto.js'
import type { PingResponse } from './dto/responses/ping.response.js'
import type { AiSettings } from './entities/ai-settings.entity.js'
import { SettingsService } from './settings.service.js'

@Controller('api/v1/settings')
export class SettingsController {
    constructor(private readonly settings: SettingsService) {}

    @Get('ai')
    showAi(): Promise<AiSettings> {
        return this.settings.show()
    }

    @Put('ai')
    updateAi(@Body() dto: AiSettingsDto): Promise<AiSettings> {
        return this.settings.update(dto)
    }

    /** Os modelos que o provedor oferece; é POST porque a chave vai no corpo, e não na query. */
    @Post('ai/models')
    @HttpCode(200)
    listModels(@Body() dto: ListModelsDto): Promise<AvailableModel[]> {
        return this.settings.availableModels(dto)
    }

    /** Uma chamada ao modelo escolhido, para conferir o cadastro sem gravá-lo. */
    @Post('ai/ping')
    @HttpCode(200)
    ping(@Body() dto: PingModelDto): Promise<PingResponse> {
        return this.settings.ping(dto)
    }
}
