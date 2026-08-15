import { Module } from '@nestjs/common'
import { ApiModule } from './modules/api.module.js'
import { AppController } from './app.controller.js'
import { RecorderModule } from './webdriver/recorder/recorder.module.js'
import { RunnerModule } from './webdriver/runner/runner.module.js'
import { VideoModule } from './webdriver/video/video.module.js'
import { WsModule } from './webdriver/gateway/ws.module.js'

@Module({
    imports: [
        ApiModule,
        VideoModule,
        RecorderModule,
        RunnerModule,
        WsModule,
    ],
    controllers: [AppController],
})
export class AppModule { }
