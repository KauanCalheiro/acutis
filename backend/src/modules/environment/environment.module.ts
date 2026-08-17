import { Module } from '@nestjs/common'
import { ProjectModule } from '../project/project.module.js'
import { EnvironmentController } from '../../controllers/environment/environment.controller.js'
import { EnvironmentService } from './environment.service.js'
import { EnvironmentUseCases } from '../../use-cases/environment/environment.use-cases.js'

@Module({
    imports: [ProjectModule],
    controllers: [EnvironmentController],
    providers: [EnvironmentService, EnvironmentUseCases],
    exports: [EnvironmentService]
})
export class EnvironmentModule {}
