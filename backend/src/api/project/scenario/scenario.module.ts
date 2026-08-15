import { Module } from '@nestjs/common'
import { RunnerModule } from '../../../runner/runner.module.js'
import { ProjectService } from '../project.service.js'
import { ScenarioController } from './scenario.controller.js'
import { ScenarioService } from './scenario.service.js'

/**
 * O `ProjectService` é provido aqui de novo, em vez de importado do `ProjectModule`: é ele quem
 * importa este módulo, e importar de volta fecharia um ciclo. O serviço não guarda estado — só
 * resolve caminhos —, então uma segunda instância é indistinguível da primeira.
 */
@Module({
    imports: [RunnerModule],
    controllers: [ScenarioController],
    providers: [ScenarioService, ProjectService],
    exports: [ScenarioService]
})
export class ScenarioModule {}
