/**
 * O `acutis.json` na raiz do projeto: é ele que faz um diretório qualquer ser um projeto do acutis,
 * e é por ele que a listagem reconhece o que mostrar.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ProjectManifest } from './entities/project.entity.js'

export const MANIFEST_VERSION = 1

/** @returns o `created_at` (ISO 8601) gravado no manifesto. */
export function writeManifest(path: string, name: string, slug: string): string {
    const createdAt = new Date().toISOString()

    const body = { name, slug, created_at: createdAt, version: MANIFEST_VERSION }

    writeFileSync(join(path, 'acutis.json'), `${JSON.stringify(body, null, 4)}\n`)

    return createdAt
}

/** O manifesto lido do disco, ou vazio quando o arquivo não existe ou está corrompido. */
export function readManifest(path: string): Partial<ProjectManifest & { auth_skipped: boolean, url_skipped: boolean }> {
    try {
        return JSON.parse(readFileSync(join(path, 'acutis.json'), 'utf8'))
    } catch {
        return {}
    }
}
