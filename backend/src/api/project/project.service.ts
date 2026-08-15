/**
 * As operações de projeto. É para cá que vieram as Actions do Laravel — `CreateProjectFromTemplate`,
 * `ListProjects`, `ShowProject`, `UpdateProject`, `DeleteProject` — agrupadas por domínio em vez de
 * uma classe por operação.
 *
 * O repositório é o sistema de arquivos: um projeto é um diretório com um `acutis.json` dentro.
 */
import { Injectable } from '@nestjs/common'
import { cpSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { acutis } from '../kernel/acutis.js'
import { NotFound } from '../kernel/errors.js'
import { slug as toSlug } from '../kernel/slug.js'
import { Environments } from './environment/environments.js'
import { Project } from './entities/project.entity.js'
import { writeManifest } from './manifest.js'
import { DEFAULT_TEMPLATE, templatePath } from './template.js'

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
