import { cpSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { acutis } from '../../../common/utils/acutis.js'
import { slug as toSlug } from '../../../common/utils/slug.js'
import type { GitService, CloneRequest } from '../../git/git.service.js'
import { Git, providerFromUrl } from '../../git/providers/git.js'
import { Environments } from '../../environment/providers/environments.js'
import { ValidationFailed } from '../../../common/exceptions/errors.js'
import { Project } from '../entities/project.entity.js'
import type { ProjectWriter } from '../ports/project-writer.js'
import { writeManifest } from './manifest.js'
import {
  DEFAULT_TEMPLATE,
  hasBundledTemplate,
  templatePath,
  writeBundledTemplate
} from './template.js'

export class FileSystemProjectWriter implements ProjectWriter {
  constructor(private readonly git: GitService) {}

  create(name: string): Project {
    const source = templatePath(DEFAULT_TEMPLATE)

    if (!hasBundledTemplate() && (!existsSync(source) || !statSync(source).isDirectory())) {
      throw new Error(`Template '${DEFAULT_TEMPLATE}' não encontrado.`)
    }

    const slug = toSlug(name)
    const path = join(acutis().root, slug)

    if (slug === '') {
      throw new ValidationFailed({ name: ['O nome deve conter ao menos um caractere alfanumérico.'] })
    }
    if (existsSync(path)) {
      throw new ValidationFailed({ name: ['Já existe um projeto com este nome.'] })
    }

    if (hasBundledTemplate()) {
      writeBundledTemplate(path)
    } else {
      cpSync(source, path, { recursive: true })
    }

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

    if (existsSync(path)) {
      throw new ValidationFailed({ url: ['Já existe um projeto com este nome.'] })
    }

    await this.git.clone(request, path)

    const createdAt = writeManifest(path, name, slug)

    new Environments(path).ensure()

    const git = Git.in(path)
    const repository = await git.remoteUrl()

    // O manifesto e o `.gitignore` nascem aqui, no repositório de outra pessoa: é o clone que versiona.
    await git.save(
      'chore: registrar o projeto no acutis',
      ['acutis.json', '.gitignore', '.gitattributes', '.env.example']
    )

    return new Project(name, slug, path, createdAt, repository, providerFromUrl(repository))
  }
}
