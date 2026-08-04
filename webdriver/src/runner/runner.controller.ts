import { Body, Controller, ForbiddenException, Get, NotFoundException, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { existsSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import { watchableVideo } from './run-video.js'
import { RunnerService, type RunResult } from './runner.service.js'
import type { RunEvent } from '../types/run.js'
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
        @Body('env') env?: Record<string, string>,
    ): Promise<RunResult> {
        this.ensureTestMode()

        return this.runnerService.runProject(path, { spec, grep, env })
    }

    @Post('project/stream')
    async projectStream(
        @Res() res: ServerResponse,
        @Body('path') path?: string,
        @Body('spec') spec?: string,
        @Body('grep') grep?: string,
        @Body('env') env?: Record<string, string>,
    ): Promise<void> {
        if (process.env.WEBDRIVER_TEST_MODE !== '1') {
            res.statusCode = 403
            res.end(JSON.stringify({ message: 'runner endpoints only available with WEBDRIVER_TEST_MODE=1' }))

            return
        }

        res.setHeader('Content-Type', 'application/x-ndjson')

        // O motivo de uma falha antes do primeiro teste (config que não casa o spec, import
        // quebrado, dependência faltando) só existe na saída do processo, que o reporter nunca vê.
        // Por isso o run:finished é segurado e reemitido com o output — sem ele quem escuta recebe
        // "falhou" e mais nada, e a interface não tem o que mostrar.
        let finished: RunEvent | null = null

        const result = await this.runnerService.streamProject(
            path ?? '',
            { spec, grep, env },
            (event) => {
                if (event.event === 'run:finished') {
                    finished = event

                    return
                }

                res.write(`${JSON.stringify(event)}\n`)
            },
        )

        const end: RunEvent = finished ?? { event: 'run:finished', status: 'failed', passed: false }

        res.write(`${JSON.stringify(result.passed ? end : { ...end, output: result.output })}\n`)
        res.end()
    }

    @Get('video')
    async video(@Query('path') path: string, @Res() res: Response): Promise<void> {
        this.ensureTestMode()

        if (!path.endsWith('.webm') || !existsSync(path)) {
            throw new NotFoundException()
        }

        res.sendFile(await watchableVideo(path))
    }
}
