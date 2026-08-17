import { Module } from '@nestjs/common'
import { GitController } from '../../controllers/git/git.controller.js'
import { GitService } from './git.service.js'
import { GitUseCases } from '../../use-cases/git/git.use-cases.js'

@Module({
    controllers: [GitController],
    providers: [GitService, GitUseCases],
    exports: [GitService]
})
export class GitModule {}
