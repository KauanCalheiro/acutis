import { Module } from '@nestjs/common'
import { ApiModule } from './api/api.module.js'
import { AppController } from './app.controller.js'
import { RecorderModule } from './recorder/recorder.module.js'
import { RunnerModule } from './runner/runner.module.js'
import { VideoModule } from './video/video.module.js'
import { WsModule } from './ws/ws.module.js'

@Module({
    imports: [
        // A API migrada do Laravel. Entra ao lado do gravador e do runner, e os chama por injeção —
        // é o que fez as duas chamadas HTTP internas virarem chamada de função.
        ApiModule,
        VideoModule,
        RecorderModule,
        RunnerModule,
        WsModule,
    ],
    controllers: [AppController],
})
export class AppModule { }
