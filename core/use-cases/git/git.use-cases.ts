import type { GitService } from '../../modules/git/git.service.js'

export class GitUseCases {
  constructor(private readonly service: GitService) {}
  async probe(url: string) { return { public: await this.service.probe(url) } }
}
