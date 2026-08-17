/** Os endpoints de projeto. */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { CloneProjectDto } from '../../dto/project/clone-project.dto.js'
import { CreateProjectDto } from '../../dto/project/create-project.dto.js'
import { ProjectSettingsDto } from '../../dto/project/project-settings.dto.js'
import { UpdateProjectDto } from '../../dto/project/update-project.dto.js'
import { AuthCredentialsDto } from '../../dto/auth/auth-credentials.dto.js'
import type { PaginatedResponse, ProjectShowResponse } from '../../dto/project/responses/project.response.js'
import { Project } from '../../modules/project/entities/project.entity.js'
import { ProjectUseCases } from '../../use-cases/project/project.use-cases.js'
import { CreateProject } from '../../use-cases/project/create-project.js'
import { CloneProject } from '../../use-cases/project/clone-project.js'

/** Os parâmetros de listagem chegam como `filter[name]`, `page[size]` — o formato JSON:API. */
interface ListParams {
    filter?: { name?: string, slug?: string }
    search?: string
    sort?: string
    page?: { size?: string, number?: string }
}

@Controller('api/v1/projects')
export class ProjectController {
    constructor(
        private readonly projects: ProjectUseCases,
        private readonly createProject: CreateProject,
        private readonly cloneProject: CloneProject
    ) {}

    @Get()
    index(@Query() params: ListParams): Promise<PaginatedResponse<Project>> {
        return this.projects.findAll({
            filters: params.filter,
            search: params.search,
            sort: params.sort,
            page: {
                size: params.page?.size ? Number(params.page.size) : undefined,
                number: params.page?.number ? Number(params.page.number) : undefined
            }
        })
    }

    @Get(':project')
    show(@Param('project') slug: string): Promise<ProjectShowResponse> {
        return this.projects.findOne(slug)
    }

    /**
     * O relatório HTML da última execução, servido como site: o índice, e os arquivos que ele
     * carrega para mostrar vídeo e trace.
     */
    @Get(':project/report/*')
    report(
        @Param('project') slug: string,
        @Param('0') path: string | undefined,
        @Res() response: Response
    ): void {
        response.sendFile(this.projects.reportFile(slug, path))
    }

    @Post('create/template')
    @HttpCode(201)
    store(@Body() dto: CreateProjectDto): Project {
        return this.createProject.execute(dto.name)
    }

    @Post('create/clone')
    @HttpCode(201)
    clone(@Body() dto: CloneProjectDto): Promise<Project> {
        return this.cloneProject.execute(dto)
    }

    @Put(':project')
    update(@Param('project') slug: string, @Body() dto: UpdateProjectDto): Promise<Project> {
        return this.projects.update(slug, dto.name)
    }

    @Delete(':project')
    @HttpCode(204)
    destroy(@Param('project') slug: string): void {
        this.projects.remove(slug)
    }

    @Put(':project/settings')
    updateSettings(
        @Param('project') slug: string,
        @Body() dto: ProjectSettingsDto
    ): { base_url: string } {
        return { base_url: this.projects.setBaseUrl(slug, dto.baseUrl) }
    }

    @Post(':project/settings/skip')
    @HttpCode(204)
    skipUrl(@Param('project') slug: string): void {
        this.projects.skipUrl(slug)
    }

    @Post(':project/auth/credentials')
    @HttpCode(204)
    authCredentials(@Param('project') slug: string, @Body() dto: AuthCredentialsDto): void {
        this.projects.saveCredentials(slug, dto.username, dto.password)
    }
}
