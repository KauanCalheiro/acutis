import { Module } from '@nestjs/common'
import { RunnerModule } from '../../webdriver/runner/runner.module.js'
import { ProjectModule } from '../project/project.module.js'
import { ScenarioController } from '../../controllers/scenario/scenario.controller.js'
import { ScenarioService } from './scenario.service.js'
import { ScenarioRunner } from './ports/scenario-runner.js'
import { WebdriverScenarioRunner } from './providers/webdriver-scenario-runner.js'
import { RunScenario } from '../../use-cases/scenario/run-scenario.js'
import { StoreRunHistory } from '../../use-cases/scenario/store-run-history.js'
import { ScenarioUseCases } from '../../use-cases/scenario/scenario.use-cases.js'

@Module({
    imports: [ProjectModule, RunnerModule],
    controllers: [ScenarioController],
    providers: [
        ScenarioService,
        RunScenario,
        StoreRunHistory,
        ScenarioUseCases,
        {
            provide: ScenarioRunner,
            useClass: WebdriverScenarioRunner
        }
    ],
    exports: [ScenarioService]
})
export class ScenarioModule {}
