/**
 * Os endpoints de cenário. O id é curinga porque pode ter barra: um cenário em subpasta
 * (`checkout/pagar`) continua sendo um id só.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Environments } from '../environment/providers/environments.js'
import { ProjectService } from '../project/project.service.js'
import { RunnerService } from '../../webdriver/runner/runner.service.js'
import { UpdateScenarioDto } from './dto/update-scenario.dto.js'
import type { ScenarioResponse } from './dto/responses/scenario.response.js'
import { ScenarioService, type RunEventRecord } from './scenario.service.js'

@Controller('api/v1/projects')
export class ScenarioController {
    constructor(
        private readonly scenarios: ScenarioService,
        private readonly projects: ProjectService,
        private readonly runner: RunnerService
    ) {}

    @Get(':project/scenarios/*')
    show(@Param('project') slug: string, @Param('0') id: string): ScenarioResponse {
        return this.scenarios.findOne(slug, id)
    }

    @Patch(':project/scenarios/*')
    update(
        @Param('project') slug: string,
        @Param('0') id: string,
        @Body() dto: UpdateScenarioDto
    ): ScenarioResponse {
        return this.scenarios.update(slug, id, dto)
    }

    @Delete(':project/scenarios/*')
    @HttpCode(204)
    destroy(@Param('project') slug: string, @Param('0') id: string): void {
        this.scenarios.remove(slug, id)
    }

    /** Roda o projeto inteiro, ou o que o filtro alcançar, e devolve o resultado de uma vez. */
    @Post(':project/run')
    @HttpCode(200)
    async run(
        @Param('project') slug: string,
        @Body('spec') spec?: string,
        @Body('grep') grep?: string
    ): Promise<{ passed: boolean, output: string }> {
        const path = this.projects.pathOf(slug)
        const env = new Environments(path).resolve()

        const result = await this.runner.runProject(path, { spec, grep, env })

        return { passed: Boolean(result.passed), output: result.output ?? '' }
    }

    /** A execução repassada evento a evento; a de um spec é guardada no histórico dele no fim. */
    @Get(':project/run/stream')
    async runStream(
        @Param('project') slug: string,
        @Res() response: Response,
        @Query('spec') spec?: string,
        @Query('grep') grep?: string
    ): Promise<void> {
        const path = this.projects.pathOf(slug)
        const env = new Environments(path).resolve()
        const startedAt = new Date()
        const events: RunEventRecord[] = []

        response.status(200)
        response.setHeader('Content-Type', 'text/event-stream')
        response.setHeader('Cache-Control', 'no-cache')
        response.setHeader('X-Accel-Buffering', 'no')

        // O `run:finished` manda a interface recarregar o cenário: só sai com o histórico gravado.
        let finished: unknown = null

        await this.runner.streamProject(path, { spec, grep, env }, (event) => {
            events.push(event as unknown as RunEventRecord)

            if (event.event === 'run:finished') {
                finished = event

                return
            }

            response.write(`data: ${JSON.stringify(event)}\n\n`)
        })

        if (spec) {
            await this.scenarios.persistRun(path, spec, events, startedAt)
        }

        if (finished) response.write(`data: ${JSON.stringify(finished)}\n\n`)

        response.end()
    }
}
