/**
 * A tela de configurações de IA, no mesmo caminho `/api/v1/*` que o Laravel serve hoje.
 */
import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common'
import type { AvailableModel } from '../ai/model-catalog.js'
import { AiSettingsDto } from './dto/ai-settings.dto.js'
import { ListModelsDto } from './dto/list-models.dto.js'
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

    /**
     * Os modelos que o provedor oferece, para a tela montar a lista de escolha.
     *
     * É POST porque a tela pergunta antes de salvar: o usuário digita a chave, vê os modelos e só
     * então escolhe um. Mandar a chave na query a deixaria no histórico e no log do servidor.
     */
    @Post('ai/models')
    @HttpCode(200)
    listModels(@Body() dto: ListModelsDto): Promise<AvailableModel[]> {
        return this.settings.availableModels(dto)
    }
}
