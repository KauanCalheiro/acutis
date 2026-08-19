import type { GenerationService } from '../../modules/generation/generation.service.js'
import type { DraftRecordingRequest as DraftRecordingDto, WriteTestRequest as WriteTestDto } from '#shared/contracts/generation'

export class GenerationUseCases {
  constructor(private readonly service: GenerationService) {}
  draft(slug: string, dto: DraftRecordingDto) { return this.service.draft(slug, dto) }
  write(slug: string, dto: WriteTestDto) { return this.service.write(slug, dto) }
}
