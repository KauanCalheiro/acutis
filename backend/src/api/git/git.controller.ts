/**
 * Sondagem de repositório, no caminho que o Laravel serve hoje.
 *
 * Fica em `/projects/probe` e não em `/git/probe` porque é o endereço que o frontend já chama — o
 * contrato com a tela não muda na migração.
 */
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
