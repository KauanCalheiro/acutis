import { Injectable } from '@nestjs/common'
import { GenerationService } from '../../modules/generation/generation.service.js'
import type { DraftRecordingDto } from '../../dto/generation/draft-recording.dto.js'
import type { WriteTestDto } from '../../dto/generation/write-test.dto.js'

@Injectable()
export class GenerationUseCases {
    constructor(private readonly service: GenerationService) {}
    draft(slug: string, dto: DraftRecordingDto) { return this.service.draft(slug, dto) }
    write(slug: string, dto: WriteTestDto) { return this.service.write(slug, dto) }
}
