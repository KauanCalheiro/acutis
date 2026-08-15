import { Module } from '@nestjs/common'
import { GitModule } from '../git/git.module.js'
import { ProjectController } from './project.controller.js'
import { ProjectService } from './project.service.js'

@Module({
    imports: [GitModule],
    controllers: [ProjectController],
    providers: [ProjectService],
    exports: [ProjectService]
})
export class ProjectModule {}
