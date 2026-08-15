import { Module } from '@nestjs/common'
import { VideoModule } from '../video/video.module.js'
import { DebugController } from './debug.controller.js'
import { RecorderService } from './recorder.service.js'

@Module({
    imports: [VideoModule],
    controllers: [DebugController],
    providers: [RecorderService],
    exports: [RecorderService],
})
export class RecorderModule { }
