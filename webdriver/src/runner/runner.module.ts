import { Module } from '@nestjs/common'
import { RunGateway } from './run.gateway.js'
import { RunnerController } from './runner.controller.js'
import { RunnerService } from './runner.service.js'
import { SnapshotService } from './snapshot.service.js'

@Module({
    controllers: [RunnerController],
    providers: [RunnerService, SnapshotService, RunGateway],
})
export class RunnerModule { }
