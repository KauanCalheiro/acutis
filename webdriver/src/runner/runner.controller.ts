import { Body, Controller, ForbiddenException, Post, Res } from '@nestjs/common'
import type { ServerResponse } from 'node:http'
import { RunnerService, type RunResult } from './runner.service.js'
import { SnapshotService, type Snapshot } from './snapshot.service.js'

@Controller('runner')
export class RunnerController {
    constructor(
        private readonly runnerService: RunnerService,
        private readonly snapshotService: SnapshotService,
    ) { }

    private ensureTestMode(): void {
        if (process.env.WEBDRIVER_TEST_MODE !== '1') {
            throw new ForbiddenException('runner endpoints only available with WEBDRIVER_TEST_MODE=1')
        }
    }

    @Post('spec')
    async spec(
        @Body('spec') spec: string,
        @Body('baseUrl') baseUrl?: string,
        @Body('env') env?: Record<string, string>,
    ): Promise<RunResult> {
        this.ensureTestMode()

        return this.runnerService.run(spec, { baseUrl, env })
    }

    @Post('snapshot')
    async snapshot(@Body('url') url: string): Promise<Snapshot> {
        this.ensureTestMode()

        return this.snapshotService.capture(url)
    }

    @Post('project')
    async project(
        @Body('path') path: string,
        @Body('spec') spec?: string,
        @Body('grep') grep?: string,
    ): Promise<RunResult> {
        this.ensureTestMode()

        return this.runnerService.runProject(path, { spec, grep })
    }

    @Post('project/stream')
    async projectStream(
        @Res() res: ServerResponse,
        @Body('path') path?: string,
        @Body('spec') spec?: string,
        @Body('grep') grep?: string,
    ): Promise<void> {
        if (process.env.WEBDRIVER_TEST_MODE !== '1') {
            res.statusCode = 403
            res.end(JSON.stringify({ message: 'runner endpoints only available with WEBDRIVER_TEST_MODE=1' }))

            return
        }

        res.setHeader('Content-Type', 'application/x-ndjson')

        await this.runnerService.streamProject(
            path ?? '',
            { spec, grep },
            (event) => res.write(`${JSON.stringify(event)}\n`),
        )

        res.end()
    }
}
