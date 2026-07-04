import { Module } from '@nestjs/common'
import { RunnerController } from './runner.controller.js'
import { RunnerService } from './runner.service.js'
import { SnapshotService } from './snapshot.service.js'

@Module({
    controllers: [RunnerController],
    providers: [RunnerService, SnapshotService],
})
export class RunnerModule { }
