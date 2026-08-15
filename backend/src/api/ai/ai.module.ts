import { Module } from '@nestjs/common'
import { ProjectModule } from '../project/project.module.js'
import { SettingsModule } from '../settings/settings.module.js'
import { ScenarioAiController } from './scenario-ai.controller.js'
import { ScenarioAiService } from './scenario-ai.service.js'

@Module({
    imports: [ProjectModule, SettingsModule],
    controllers: [ScenarioAiController],
    providers: [ScenarioAiService]
})
export class AiModule {}
