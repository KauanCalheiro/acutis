import { Injectable } from '@nestjs/common'
import { cpSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { acutis } from '../../../common/utils/acutis.js'
import { slug as toSlug } from '../../../common/utils/slug.js'
import { GitService, type CloneRequest } from '../../git/git.service.js'
import { Git, providerFromUrl } from '../../git/providers/git.js'
import { Environments } from '../../environment/providers/environments.js'
import { Project } from '../entities/project.entity.js'
import { ProjectWriter } from '../ports/project-writer.js'
import { writeManifest } from './manifest.js'
import { DEFAULT_TEMPLATE, templatePath } from './template.js'

@Injectable()
export class FileSystemProjectWriter implements ProjectWriter {
    constructor(private readonly git: GitService) {}

    create(name: string): Project {
        const source = templatePath(DEFAULT_TEMPLATE)

        if (!existsSync(source) || !statSync(source).isDirectory()) {
            throw new Error(`Template '${DEFAULT_TEMPLATE}' não encontrado.`)
        }

        const slug = toSlug(name)
        const path = join(acutis().root, slug)

        cpSync(source, path, { recursive: true })

        const packageFile = join(path, 'package.json')

        if (existsSync(packageFile)) {
            writeFileSync(packageFile, readFileSync(packageFile, 'utf8').replaceAll('{{name}}', slug))
        }

        const createdAt = writeManifest(path, name, slug)

        new Environments(path).ensure()

        return new Project(name, slug, path, createdAt)
    }

    async clone(request: CloneRequest): Promise<Project> {
        const name = request.name || basename(request.url).replace(/\.git$/, '')
        const slug = toSlug(name)
        const path = join(acutis().root, slug)

        await this.git.clone(request, path)

        const createdAt = writeManifest(path, name, slug)

        new Environments(path).ensure()

        const repository = await Git.in(path).remoteUrl()

        return new Project(name, slug, path, createdAt, repository, providerFromUrl(repository))
    }
}
