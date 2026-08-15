import { Module } from '@nestjs/common'
import { RunnerService } from '../../webdriver/runner/runner.service.js'
import { ProjectModule } from '../project/project.module.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

@Module({
    imports: [ProjectModule],
    controllers: [AuthController],
    providers: [AuthService, RunnerService],
    exports: [AuthService]
})
export class AuthModule {}
