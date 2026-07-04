import { Body, Controller, ForbiddenException, Post } from '@nestjs/common'
import { RunnerService, type RunResult } from './runner.service.js'

@Controller('runner')
export class RunnerController {
    constructor(
        private readonly runnerService: RunnerService,
    ) { }

    private ensureTestMode(): void {
        if (process.env.WEBDRIVER_TEST_MODE !== '1') {
            throw new ForbiddenException('runner endpoints only available with WEBDRIVER_TEST_MODE=1')
        }
    }

    @Post('spec')
    async spec(@Body('spec') spec: string, @Body('baseUrl') baseUrl?: string): Promise<RunResult> {
        this.ensureTestMode()

        return this.runnerService.run(spec, baseUrl)
    }
}
