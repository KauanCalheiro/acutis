/**
 * Os endpoints de projeto, no mesmo caminho `/api/v1/*` que o Laravel serve hoje — é o que permite o
 * frontend trocar de backend sem alterar uma chamada.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { GitService } from '../git/git.service.js'
import { CloneProjectDto } from './dto/clone-project.dto.js'
import { CreateProjectDto } from './dto/create-project.dto.js'
import { ProjectSettingsDto } from './dto/project-settings.dto.js'
import { UpdateProjectDto } from './dto/update-project.dto.js'
import { AuthCredentialsDto } from '../auth/dto/auth-credentials.dto.js'
import type { PaginatedResponse, ProjectShowResponse } from './dto/responses/project.response.js'
import { Project } from './entities/project.entity.js'
import { ProjectService } from './project.service.js'

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
        private readonly projects: ProjectService,
        private readonly git: GitService
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

    @Post('create/template')
    @HttpCode(201)
    store(@Body() dto: CreateProjectDto): Project {
        return this.projects.create(dto.name)
    }

    @Post('create/clone')
    @HttpCode(201)
    clone(@Body() dto: CloneProjectDto): Promise<Project> {
        return this.projects.createFromClone(dto, this.git)
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
