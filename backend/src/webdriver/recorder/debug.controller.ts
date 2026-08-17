import { Body, Controller, ForbiddenException, Post } from '@nestjs/common'
import { RecorderService } from './recorder.service.js'
import { APP_CONFIG } from '../../config/env.js'

@Controller('debug')
export class DebugController {
    constructor(
        private readonly recorderService: RecorderService,
    ) { }

    private ensureTestMode(): void {
        if (!APP_CONFIG.webdriverTestMode) {
            throw new ForbiddenException('debug endpoints only available with WEBDRIVER_TEST_MODE=1')
        }
    }

    @Post('goto')
    async goto(@Body('url') url: string): Promise<{ ok: true }> {
        this.ensureTestMode()
        await this.recorderService.debugGoto(url)
        return { ok: true }
    }

    @Post('click')
    async click(@Body('selector') selector: string): Promise<{ ok: true }> {
        this.ensureTestMode()
        await this.recorderService.debugClick(selector)
        return { ok: true }
    }

    @Post('fill')
    async fill(@Body('selector') selector: string, @Body('value') value: string): Promise<{ ok: true }> {
        this.ensureTestMode()
        await this.recorderService.debugFill(selector, value)
        return { ok: true }
    }
}
