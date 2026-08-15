/** A sondagem de repositório, servida em `/projects/probe`. */
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ProbeRepositoryDto } from './dto/probe-repository.dto.js'
import { GitService } from './git.service.js'

@Controller('api/v1/projects')
export class GitController {
    constructor(private readonly git: GitService) {}

    @Post('probe')
    @HttpCode(200)
    async probe(@Body() dto: ProbeRepositoryDto): Promise<{ public: boolean }> {
        return { public: await this.git.probe(dto.url) }
    }
}
