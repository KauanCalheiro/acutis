import { Module } from '@nestjs/common'
import { ProjectModule } from '../project/project.module.js'
import { SettingsModule } from '../settings/settings.module.js'
import { ScenarioAiController } from '../../controllers/ai/scenario-ai.controller.js'
import { ScenarioAiService } from './scenario-ai.service.js'
import { ScenarioAiUseCases } from '../../use-cases/ai/scenario-ai.use-cases.js'

@Module({
    imports: [ProjectModule, SettingsModule],
    controllers: [ScenarioAiController],
    providers: [ScenarioAiService, ScenarioAiUseCases]
})
export class AiModule {}
