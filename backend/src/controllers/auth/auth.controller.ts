/** Os endpoints de autenticação do projeto; as credenciais são servidas pelo `ProjectController`. */
import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import type { GeneratedAuthSetup } from '@acutis/contracts/auth'
import { AuthUseCases } from '../../use-cases/auth/auth.use-cases.js'
import { AuthRecordingDto } from '../../dto/auth/auth-recording.dto.js'
import { UpdateAuthSetupDto } from '../../dto/auth/update-auth-setup.dto.js'

@Controller('api/v1/projects')
export class AuthController {
    constructor(private readonly auth: AuthUseCases) {}

    @Get(':project/auth')
    show(@Param('project') slug: string): { authSetup: string } {
        return { authSetup: this.auth.show(slug) }
    }

    @Put(':project/auth')
    update(@Param('project') slug: string, @Body() dto: UpdateAuthSetupDto): { authSetup: string } {
        return { authSetup: this.auth.update(slug, dto.authSetup) }
    }

    @Post(':project/auth/skip')
    @HttpCode(204)
    skip(@Param('project') slug: string): void {
        this.auth.skip(slug)
    }

    @Post(':project/auth/record')
    @HttpCode(200)
    record(@Param('project') slug: string, @Body() dto: AuthRecordingDto): Promise<GeneratedAuthSetup> {
        return this.auth.record(slug, dto)
    }
}
