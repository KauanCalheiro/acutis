import { Module } from '@nestjs/common'
import { SettingsModule } from '../settings/settings.module.js'
import { ProjectModule } from '../project/project.module.js'
import { GenerationController } from './generation.controller.js'
import { GenerationService } from './generation.service.js'

@Module({
    imports: [ProjectModule, SettingsModule],
    controllers: [GenerationController],
    providers: [GenerationService]
})
export class GenerationModule {}
