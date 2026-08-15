import { Module } from '@nestjs/common'
import { RunnerController } from './runner.controller.js'
import { RunnerService } from './runner.service.js'

@Module({
    controllers: [RunnerController],
    providers: [RunnerService],
    exports: [RunnerService],
})
export class RunnerModule { }
