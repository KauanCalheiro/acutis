import { Module } from '@nestjs/common'
import { GitModule } from '../git/git.module.js'
import { ProjectController } from '../../controllers/project/project.controller.js'
import { ProjectService } from './project.service.js'
import { ProjectWriter } from './ports/project-writer.js'
import { FileSystemProjectWriter } from './providers/filesystem-project-writer.js'
import { CreateProject } from '../../use-cases/project/create-project.js'
import { CloneProject } from '../../use-cases/project/clone-project.js'
import { ProjectUseCases } from '../../use-cases/project/project.use-cases.js'

@Module({
    imports: [GitModule],
    controllers: [ProjectController],
    providers: [
        ProjectService,
        CreateProject,
        CloneProject,
        ProjectUseCases,
        {
            provide: ProjectWriter,
            useClass: FileSystemProjectWriter
        }
    ],
    exports: [ProjectService]
})
export class ProjectModule {}
