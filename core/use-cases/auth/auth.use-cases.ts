import type { AuthService } from '../../modules/auth/auth.service.js'
import type { AuthRecordingRequest as AuthRecordingDto } from '#shared/contracts/auth'

export class AuthUseCases {
  constructor(private readonly service: AuthService) {}
  show(slug: string) { return this.service.show(slug) }
  update(slug: string, setup: string) { return this.service.update(slug, setup) }
  skip(slug: string) { return this.service.skip(slug) }
  record(slug: string, recording: AuthRecordingDto) { return this.service.record(slug, recording) }
}
