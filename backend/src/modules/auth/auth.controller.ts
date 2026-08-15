/** Os endpoints de autenticação do projeto; as credenciais são servidas pelo `ProjectController`. */
import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common'
import { AuthService, type GeneratedAuthSetup } from './auth.service.js'
import { AuthRecordingDto } from './dto/auth-recording.dto.js'
import { UpdateAuthSetupDto } from './dto/update-auth-setup.dto.js'

@Controller('api/v1/projects')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

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

    // 200, e não o 201 que o Nest dá a todo POST: a resposta é o arquivo gerado.
    @Post(':project/auth/record')
    @HttpCode(200)
    record(@Param('project') slug: string, @Body() dto: AuthRecordingDto): Promise<GeneratedAuthSetup> {
        return this.auth.record(slug, dto)
    }
}
