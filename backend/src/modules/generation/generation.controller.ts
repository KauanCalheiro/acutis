/**
 * Os dois passos que transformam uma gravação em cenário: o rascunho que a tela mostra para revisão
 * e a escrita dos arquivos no projeto.
 */
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { DraftRecordingDto } from './dto/draft-recording.dto.js'
import { WriteTestDto } from './dto/write-test.dto.js'
import { GenerationService, type TestDraft, type WrittenTest } from './generation.service.js'

@Controller('api/v1/projects/:project/tests')
export class GenerationController {
    constructor(private readonly generation: GenerationService) {}

    @Post('draft')
    @HttpCode(200)
    draft(@Param('project') slug: string, @Body() dto: DraftRecordingDto): Promise<TestDraft> {
        return this.generation.draft(slug, dto)
    }

    /** O `testRun` sempre nulo: executar o rascunho ficou para quando a IA voltar. */
    @Post()
    @HttpCode(200)
    write(
        @Param('project') slug: string,
        @Body() dto: WriteTestDto
    ): WrittenTest & { testRun: null } {
        return { ...this.generation.write(slug, dto), testRun: null }
    }
}
