import { Module } from '@nestjs/common'
import { RunnerModule } from '../../webdriver/runner/runner.module.js'
import { ProjectService } from '../project/project.service.js'
import { ScenarioController } from './scenario.controller.js'
import { ScenarioService } from './scenario.service.js'

@Module({
    imports: [RunnerModule],
    controllers: [ScenarioController],
    providers: [ScenarioService, ProjectService],
    exports: [ScenarioService]
})
export class ScenarioModule {}
