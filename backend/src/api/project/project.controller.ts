/**
 * Os endpoints de projeto, no mesmo caminho `/api/v1/*` que o Laravel serve hoje — é o que permite o
 * frontend trocar de backend sem alterar uma chamada.
 */
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { CreateProjectDto } from './dto/create-project.dto.js'
import { Project } from './entities/project.entity.js'
import { ProjectService } from './project.service.js'

@Controller('api/v1/projects')
export class ProjectController {
    constructor(private readonly projects: ProjectService) {}

    @Post('create/template')
    @HttpCode(201)
    store(@Body() dto: CreateProjectDto): Project {
        return this.projects.create(dto.name)
    }
}
