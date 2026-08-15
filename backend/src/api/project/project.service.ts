/**
 * As operações de projeto. É para cá que vieram as Actions do Laravel — `CreateProjectFromTemplate`,
 * `ListProjects`, `ShowProject`, `UpdateProject`, `DeleteProject` — agrupadas por domínio em vez de
 * uma classe por operação.
 *
 * O repositório é o sistema de arquivos: um projeto é um diretório com um `acutis.json` dentro.
 */
import { Injectable } from '@nestjs/common'
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Git, providerFromUrl } from '../git/git.js'
import { acutis } from '../kernel/acutis.js'
import { NotFound, ValidationFailed } from '../kernel/errors.js'
import { slug as toSlug } from '../kernel/slug.js'
import { Environments } from './environment/environments.js'
import { Project, type ProjectManifest } from './entities/project.entity.js'
import { writeManifest } from './manifest.js'
import { DEFAULT_TEMPLATE, templatePath } from './template.js'

/** Os campos por que a listagem aceita ordenar. Fora deles, ordena por nome. */
const SORTABLE = ['name', 'slug', 'created_at'] as const

export interface ListQuery {
    filters?: { name?: string, slug?: string }
    search?: string
    sort?: string
    page?: { size?: number, number?: number }
}

export interface Paginated<T> {
    data: T[]
    meta: { current_page: number, per_page: number, total: number }
}

function contains(haystack: string, needle: string): boolean {
    return haystack.toLowerCase().includes(needle.toLowerCase())
}

@Injectable()
export class ProjectService {
    /** O diretório do projeto; 404 quando não existe. */
    pathOf(slug: string): string {
        const path = join(acutis().root, slug)

        if (!existsSync(join(path, 'acutis.json'))) {
            throw new NotFound('Projeto não encontrado.')
        }

        return path
    }

    /** O mesmo caminho visto do host, para montar o link `vscode://file/`. */
    hostPathOf(slug: string): string {
        return join(acutis().hostRoot, slug)
    }

    environmentsOf(slug: string): Environments {
        return new Environments(this.pathOf(slug))
    }

    /** Um projeto lido do disco, com o que o git souber contar sobre ele. */
    private async toProject(dir: string): Promise<Project> {
        let manifest: Partial<ProjectManifest> = {}

        try {
            manifest = JSON.parse(readFileSync(join(dir, 'acutis.json'), 'utf8')) as ProjectManifest
        } catch {
            manifest = {}
        }

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

        // Campo que não dá para ordenar cai em nome ascendente, e o `-` não vale nem para inverter.
        return sortable && descending ? ordered.reverse() : ordered
    }

    async findAll(query: ListQuery = {}): Promise<Paginated<Project>> {
        const base = acutis().root

        if (!existsSync(base)) {
            return { data: [], meta: { current_page: 1, per_page: 0, total: 0 } }
        }

        const dirs = readdirSync(base, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => join(base, entry.name))
            .filter((dir) => existsSync(join(dir, 'acutis.json')))

        let projects = await Promise.all(dirs.map((dir) => this.toProject(dir)))

        const { name, slug } = query.filters ?? {}

        if (name) projects = projects.filter((project) => contains(project.name, name))
        if (slug) projects = projects.filter((project) => contains(project.slug, slug))

        if (query.search) {
            const search = query.search
            projects = projects.filter(
                (project) => contains(project.name, search) || contains(project.slug, search)
            )
        }

        projects = this.sort(projects, query.sort)

        const total = projects.length
        const size = query.page?.size ?? total
        const number = query.page?.number ?? 1
        const data = query.page?.size ? projects.slice((number - 1) * size, number * size) : projects

        return { data, meta: { current_page: number, per_page: size, total } }
    }

    /**
     * Renomear muda o diretório junto, porque o slug é o diretório. Só o manifesto guarda o nome
     * como o usuário o escreveu.
     */
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

        let manifest: Partial<ProjectManifest> = {}

        try {
            manifest = JSON.parse(readFileSync(join(path, 'acutis.json'), 'utf8')) as ProjectManifest
        } catch {
            manifest = {}
        }

        const updated = { ...manifest, name, slug: newSlug }
        writeFileSync(join(path, 'acutis.json'), `${JSON.stringify(updated, null, 4)}\n`)

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

    create(name: string, template: string = DEFAULT_TEMPLATE): Project {
        const source = templatePath(template)

        if (!existsSync(source) || !statSync(source).isDirectory()) {
            throw new Error(`Template '${template}' não encontrado.`)
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
}
