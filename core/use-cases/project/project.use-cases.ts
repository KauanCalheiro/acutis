import type { ProjectService, ListQuery } from '../../modules/project/project.service.js'

export class ProjectUseCases {
  constructor(private readonly service: ProjectService) {}
  findAll(query: ListQuery) { return this.service.findAll(query) }
  findOne(slug: string) { return this.service.findOne(slug) }
  reportFile(slug: string, path?: string) { return this.service.reportFile(slug, path) }
  update(slug: string, name: string) { return this.service.update(slug, name) }
  remove(slug: string) { return this.service.remove(slug) }
  setBaseUrl(slug: string, url: string) { return this.service.setBaseUrl(slug, url) }
  skipUrl(slug: string) { return this.service.skipUrl(slug) }
  saveCredentials(slug: string, username: string, password: string) { return this.service.saveCredentials(slug, username, password) }
}
