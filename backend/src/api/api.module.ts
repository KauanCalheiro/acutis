/**
 * A API que está sendo migrada do Laravel.
 *
 * Entra no Nest ao lado de recorder e runner, e pode chamá-los por injeção — nunca o contrário. É a
 * fronteira que mantém o gravador ignorante de quem o usa.
 */
import { Module } from '@nestjs/common'
import { GitModule } from './git/git.module.js'
import { EnvironmentModule } from './project/environment/environment.module.js'
import { ProjectModule } from './project/project.module.js'
import { GenerationModule } from './project/scenario/generation/generation.module.js'
import { ScenarioModule } from './project/scenario/scenario.module.js'

@Module({
    imports: [EnvironmentModule, GenerationModule, GitModule, ProjectModule, ScenarioModule]
})
export class ApiModule {}
