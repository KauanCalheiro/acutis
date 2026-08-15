import { Module } from '@nestjs/common'
import { ProjectController } from './project.controller.js'
import { ProjectService } from './project.service.js'
import { ScenarioModule } from './scenario/scenario.module.js'

@Module({
    imports: [ScenarioModule],
    controllers: [ProjectController],
    providers: [ProjectService],
    exports: [ProjectService]
})
export class ProjectModule {}
