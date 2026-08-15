import { Module } from '@nestjs/common'
import { ProjectModule } from '../project.module.js'
import { EnvironmentController } from './environment.controller.js'
import { EnvironmentService } from './environment.service.js'

@Module({
    imports: [ProjectModule],
    controllers: [EnvironmentController],
    providers: [EnvironmentService],
    exports: [EnvironmentService]
})
export class EnvironmentModule {}
