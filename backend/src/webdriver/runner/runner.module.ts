import { Module } from '@nestjs/common'
import { RunnerController } from './runner.controller.js'
import { RunnerService } from './runner.service.js'

@Module({
    controllers: [RunnerController],
    providers: [RunnerService],
    // A API migrada do Laravel chama o runner por injeção, e não mais por HTTP.
    exports: [RunnerService],
})
export class RunnerModule { }
