import { Module } from '@nestjs/common'
import { RunnerService } from '../../webdriver/runner/runner.service.js'
import { ProjectModule } from '../project/project.module.js'
import { SettingsModule } from '../settings/settings.module.js'
import { AuthController } from '../../controllers/auth/auth.controller.js'
import { AuthService } from './auth.service.js'
import { AuthUseCases } from '../../use-cases/auth/auth.use-cases.js'

@Module({
    imports: [ProjectModule, SettingsModule],
    controllers: [AuthController],
    providers: [AuthService, AuthUseCases, RunnerService],
    exports: [AuthService]
})
export class AuthModule {}
