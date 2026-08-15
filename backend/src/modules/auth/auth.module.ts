import { Module } from '@nestjs/common'
import { RunnerService } from '../../webdriver/runner/runner.service.js'
import { ProjectModule } from '../project/project.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

/**
 * O `RunnerService` é declarado aqui, e não importado do `RunnerModule`, para não registrar junto o
 * `RunnerController` no grafo da API.
 */
@Module({
    imports: [ProjectModule],
    controllers: [AuthController],
    providers: [AuthService, RunnerService],
    exports: [AuthService]
})
export class AuthModule {}
