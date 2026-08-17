import { Injectable } from '@nestjs/common'
import { GitService } from '../../modules/git/git.service.js'

@Injectable()
export class GitUseCases {
    constructor(private readonly service: GitService) {}
    async probe(url: string) { return { public: await this.service.probe(url) } }
}
