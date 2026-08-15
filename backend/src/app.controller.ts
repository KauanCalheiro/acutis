import { Controller, Get } from '@nestjs/common'
import { RecorderService } from './webdriver/recorder/recorder.service.js'

@Controller()
export class AppController {
    constructor(
        private readonly recorderService: RecorderService,
    ) { }

    @Get('health')
    health(): { ok: true; recording: boolean } {
        return { ok: true, recording: this.recorderService.isRecording() }
    }
}
