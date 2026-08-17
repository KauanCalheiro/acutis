import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module.js'
import { ProjectModule } from '../project/project.module.js'
import { GenerationController } from '../../controllers/generation/generation.controller.js'
import { GenerationService } from './generation.service.js'
import { GenerationUseCases } from '../../use-cases/generation/generation.use-cases.js'

@Module({
    imports: [ProjectModule, SettingsModule],
    controllers: [GenerationController],
    providers: [GenerationService, GenerationUseCases]
})
export class GenerationModule {}
