/** A sondagem de repositório, servida em `/projects/probe`. */
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ProbeRepositoryDto } from '../../dto/git/probe-repository.dto.js'
import { GitUseCases } from '../../use-cases/git/git.use-cases.js'

@Controller('api/v1/projects')
export class GitController {
    constructor(private readonly git: GitUseCases) {}

    @Post('probe')
    @HttpCode(200)
    async probe(@Body() dto: ProbeRepositoryDto): Promise<{ public: boolean }> {
        return this.git.probe(dto.url)
    }
}
