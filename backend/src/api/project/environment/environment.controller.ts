/**
 * Os endpoints de ambiente, no mesmo caminho `/api/v1/*` que o Laravel serve hoje — é o que permite
 * o frontend trocar de backend sem alterar uma chamada.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { EnvironmentDto } from './dto/environment.dto.js'
import { EnvironmentService, type EnvironmentList } from './environment.service.js'
import type { Environment } from './environments.js'

@Controller('api/v1/projects/:project/environments')
export class EnvironmentController {
    constructor(private readonly environments: EnvironmentService) {}

    @Get()
    index(@Param('project') project: string): EnvironmentList {
        return this.environments.list(project)
    }

    @Post()
    @HttpCode(201)
    store(@Param('project') project: string, @Body() dto: EnvironmentDto): Environment {
        return this.environments.create(project, dto.name)
    }

    @Put(':environment')
    update(
        @Param('project') project: string,
        @Param('environment') environment: string,
        @Body() dto: EnvironmentDto
    ): Environment {
        return this.environments.update(project, environment, dto)
    }

    @Delete(':environment')
    @HttpCode(204)
    destroy(@Param('project') project: string, @Param('environment') environment: string): void {
        this.environments.remove(project, environment)
    }

    @Post(':environment/activate')
    @HttpCode(200)
    activate(@Param('project') project: string, @Param('environment') environment: string): Environment {
        return this.environments.activate(project, environment)
    }
}
