/** A API `/api/v1`. */
import { Module } from '@nestjs/common'
import { GitModule } from './git/git.module.js'
import { AiModule } from './ai/ai.module.js'
import { AuthModule } from './auth/auth.module.js'
import { EnvironmentModule } from './environment/environment.module.js'
import { ProjectModule } from './project/project.module.js'
import { GenerationModule } from './generation/generation.module.js'
import { ScenarioModule } from './scenario/scenario.module.js'
import { SettingsModule } from './settings/settings.module.js'

@Module({
    imports: [AiModule, AuthModule, EnvironmentModule, GenerationModule, GitModule, ProjectModule, ScenarioModule, SettingsModule]
})
export class ApiModule {}
