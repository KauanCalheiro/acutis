/**
 * Os endpoints de cenário, no mesmo caminho `/api/v1/*` que o Laravel serve hoje.
 *
 * O id do cenário é curinga porque ele pode ter barra: um cenário em subpasta (`checkout/pagar`)
 * continua sendo um id só, e é assim que ele aparece na URL.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { Environments } from '../environment/environments.js'
import { ProjectService } from '../project.service.js'
import { RunnerService } from '../../../runner/runner.service.js'
import { UpdateScenarioDto } from './dto/update-scenario.dto.js'
import { ScenarioService, type RunEventRecord } from './scenario.service.js'

@Controller('api/v1/projects')
export class ScenarioController {
    constructor(
        private readonly scenarios: ScenarioService,
        private readonly projects: ProjectService,
        private readonly runner: RunnerService
    ) {}

    @Get(':project/scenarios/*')
    show(@Param('project') slug: string, @Param('0') id: string): Record<string, unknown> {
        return this.scenarios.findOne(slug, id)
    }

    @Patch(':project/scenarios/*')
    update(
        @Param('project') slug: string,
        @Param('0') id: string,
        @Body() dto: UpdateScenarioDto
    ): Record<string, unknown> {
        return this.scenarios.update(slug, id, dto)
    }

    @Delete(':project/scenarios/*')
    @HttpCode(204)
    destroy(@Param('project') slug: string, @Param('0') id: string): void {
        this.scenarios.remove(slug, id)
    }

    /**
     * A execução repassada evento a evento, e guardada no fim.
     *
     * O histórico só existe para cenário: rodar o projeto inteiro não pertence a nenhum, e gravar
     * essa execução sujaria o histórico de todos eles.
     */
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
        // Sem isto o nginx segura a resposta inteira, e a tela só recebe os eventos no fim.
        response.setHeader('X-Accel-Buffering', 'no')

        await this.runner.streamProject(path, { spec, grep, env }, (event) => {
            events.push(event as unknown as RunEventRecord)
            response.write(`data: ${JSON.stringify(event)}\n\n`)
        })

        if (spec) {
            await this.scenarios.persistRun(path, spec, events, startedAt)
        }

        response.end()
    }
}
