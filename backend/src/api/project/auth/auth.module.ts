import { Module } from '@nestjs/common'
import { RunnerService } from '../../../runner/runner.service.js'
import { ProjectModule } from '../project.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

/**
 * O `RunnerService` é declarado aqui, e não importado do `RunnerModule`, porque importar aquele
 * módulo registraria junto o `RunnerController` — endpoints de teste do gravador — no grafo da API.
 * O serviço não guarda estado entre execuções, então uma segunda instância não custa nada.
 */
@Module({
    imports: [ProjectModule],
    controllers: [AuthController],
    providers: [AuthService, RunnerService],
    exports: [AuthService]
})
export class AuthModule {}
