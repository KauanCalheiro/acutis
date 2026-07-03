import { Module } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { RecorderModule } from './recorder/recorder.module.js'
import { VideoModule } from './video/video.module.js'
import { WsModule } from './ws/ws.module.js'

@Module({
    imports: [
        VideoModule,
        RecorderModule,
        WsModule,
    ],
    controllers: [AppController],
})
export class AppModule { }
