/**
 * As operações de projeto. O repositório é o sistema de arquivos: um projeto é um diretório com um
 * `acutis.json` dentro.
 */
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Git, providerFromUrl, type GitSync } from '../git/providers/git.js'
import { acutis } from '../../common/utils/acutis.js'
import { NotFound, ValidationFailed } from '../../common/exceptions/errors.js'
import { slug as toSlug } from '../../common/utils/slug.js'
import { AUTH_ID, authExists } from '../auth/providers/auth.js'
import { EnvKey } from '../environment/providers/env-key.js'
import { Environments } from '../environment/providers/environments.js'
import type { ProjectDetail as ProjectShowResponse } from '#shared/contracts/project'
import { Project, type ProjectManifest } from './entities/project.entity.js'
import { patchManifest, readManifest } from './providers/manifest.js'
import { ProjectReport } from './providers/project-report.js'
import { Runs } from '../scenario/providers/runs.js'
import { listScenarios } from '../scenario/providers/scenario.js'

/** Os campos por que a listagem aceita ordenar. Fora deles, ordena por nome. */
const SORTABLE = ['name', 'slug', 'created_at'] as const

export interface ListQuery {
  filters?: { name?: string, slug?: string }
  search?: string
  sort?: string
  page?: { size?: number, number?: number }
}

interface PaginatedResponse<T> {
  data: T[]
  meta: { current_page: number, per_page: number, total: number }
}

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

export class ProjectService {
  /** O diretório do projeto dentro da raiz; 404 quando não existe ou quando o slug aponta para fora dela. */
  pathOf(slug: string): string {
    const root = acutis().root
    const path = join(root, slug)

    if (!path.startsWith(`${root}/`) || !existsSync(join(path, 'acutis.json'))) {
      throw new NotFound('Projeto não encontrado.')
    }

    return path
  }

  environmentsOf(slug: string): Environments {
    return new Environments(this.pathOf(slug))
  }

  resolvedEnvironment(slug: string): Record<string, string> {
    return this.environmentsOf(slug).resolve()
  }

  reportFile(slug: string, requested?: string): string {
    return new ProjectReport(this.pathOf(slug)).file(requested)
  }

  /** Um projeto lido do disco, com o que o git souber contar sobre ele. */
  private async toProject(dir: string): Promise<Project> {
    const manifest: Partial<ProjectManifest> = (() => {
      try {
        return JSON.parse(readFileSync(join(dir, 'acutis.json'), 'utf8')) as ProjectManifest
      } catch {
        return {}
      }
    })()

    const slug = manifest.slug ?? dir.split('/').pop()!
    const repository = await Git.in(dir).remoteUrl()

    return new Project(
      manifest.name ?? slug,
      slug,
      dir,
      manifest.created_at ?? '',
      repository,
      providerFromUrl(repository)
    )
  }

  private sort(projects: Project[], sort?: string): Project[] {
    const descending = (sort ?? '').startsWith('-')
    const field = (sort ?? '').replace(/^-/, '')
    const sortable = (SORTABLE as readonly string[]).includes(field)
    const by = (sortable ? field : 'name') as 'name' | 'slug' | 'created_at'

    const ordered = [...projects].sort((a, b) => String(a[by]).localeCompare(String(b[by])))

    return sortable && descending ? ordered.reverse() : ordered
  }

  async findAll(query: ListQuery = {}): Promise<PaginatedResponse<Project>> {
    const base = acutis().root

    if (!existsSync(base)) {
      return { data: [], meta: { current_page: 1, per_page: 0, total: 0 } }
    }

    const dirs = readdirSync(base, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => join(base, entry.name))
      .filter(dir => existsSync(join(dir, 'acutis.json')))

    let projects = await Promise.all(dirs.map(dir => this.toProject(dir)))

    const { name, slug } = query.filters ?? {}

    if (name) projects = projects.filter(project => contains(project.name, name))
    if (slug) projects = projects.filter(project => contains(project.slug, slug))

    if (query.search) {
      const search = query.search
      projects = projects.filter(
        project => contains(project.name, search) || contains(project.slug, search)
      )
    }

    projects = this.sort(projects, query.sort)

    const total = projects.length
    const size = query.page?.size ?? total
    const number = query.page?.number ?? 1
    const data = query.page?.size ? projects.slice((number - 1) * size, number * size) : projects

    return { data, meta: { current_page: number, per_page: size, total } }
  }

  /** O estado da autenticação: `unset`, `skipped`, `configured` ou `failing`. */
  private authStatus(
    path: string,
    manifest: Partial<ProjectManifest & { auth_skipped: boolean }>
  ): ProjectShowResponse['auth_status'] {
    if (!authExists(path)) {
      return manifest.auth_skipped ? 'skipped' : 'unset'
    }

    return new Runs(path, AUTH_ID).lastPassed() === false ? 'failing' : 'configured'
  }

  async findOne(slug: string): Promise<ProjectShowResponse> {
    const path = this.pathOf(slug)
    const manifest = readManifest(path)
    const project = await this.toProject(path)
    const environments = new Environments(path)
    const baseUrl = environments.value(EnvKey.URL)

    return {
      name: project.name,
      slug: project.slug,
      path: project.path,
      repository: project.repository,
      provider: project.provider,
      branch: await Git.in(path).branch(),
      created_at: project.created_at,
      updated_at: statSync(path).mtime.toISOString(),
      scenarios: listScenarios(path),
      auth_status: this.authStatus(path, manifest),
      base_url: baseUrl,
      storage_state: join(path, environments.storageState()),
      requires_url: !baseUrl && !manifest.url_skipped,
      vscode_url: `vscode://file${path}`,
      has_report: new ProjectReport(path).exists()
    }
  }

  /**
     * Junta os dois lados sozinho e informa mudança, conflito ou indisponibilidade sem impedir que
     * o projeto continue sendo usado localmente.
     */
  async sync(slug: string): Promise<GitSync> {
    return Git.in(this.pathOf(slug)).sync()
  }

  /** Renomeia o projeto, movendo o diretório junto, porque o slug é o diretório. */
  async update(slug: string, name: string): Promise<Project> {
    let path = this.pathOf(slug)
    const newSlug = toSlug(name)

    if (newSlug === '') {
      throw new ValidationFailed({
        name: ['O nome deve conter ao menos um caractere alfanumérico.']
      })
    }

    if (newSlug !== slug) {
      const newPath = join(acutis().root, newSlug)

      if (existsSync(newPath)) {
        throw new ValidationFailed({ name: ['Já existe um projeto com este nome.'] })
      }

      renameSync(path, newPath)
      path = newPath
    }

    const manifest = patchManifest(path, { name, slug: newSlug })

    const repository = await Git.in(path).remoteUrl()

    return new Project(
      name,
      newSlug,
      path,
      manifest.created_at ?? '',
      repository,
      providerFromUrl(repository)
    )
  }

  remove(slug: string): void {
    rmSync(this.pathOf(slug), { recursive: true, force: true })
  }

  /**
     * O que a configuração do projeto versiona. O `.env` e a pasta `environments` ficam de fora
     * pelo `.gitignore`: os valores são de cada máquina, e alguns são segredo.
     */
  private async syncSettings(path: string): Promise<void> {
    await Git.in(path).save('chore: atualizar configurações do projeto', [
      'acutis.json',
      '.gitignore',
      '.gitattributes',
      '.env.example'
    ])
  }

  /** Grava a URL base do sistema sob teste. */
  async setBaseUrl(slug: string, baseUrl: string): Promise<string> {
    const path = this.pathOf(slug)

    new Environments(path).set(EnvKey.URL, baseUrl)

    await this.syncSettings(path)

    return baseUrl
  }

  /** Marca no manifesto que a URL foi dispensada. */
  async skipUrl(slug: string): Promise<void> {
    const path = this.pathOf(slug)

    patchManifest(path, { url_skipped: true })

    await this.syncSettings(path)
  }

  saveCredentials(slug: string, username: string, password: string): void {
    const environments = new Environments(this.pathOf(slug)).ensure()

    environments.set(EnvKey.USER, username)
    environments.set(EnvKey.PASSWORD, password, true)
  }
}
