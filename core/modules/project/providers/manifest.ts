/**
 * O `acutis.json` na raiz do projeto: é ele que faz um diretório qualquer ser um projeto do acutis,
 * e é por ele que a listagem reconhece o que mostrar.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { ProjectManifest } from '../entities/project.entity.js'

export const MANIFEST_VERSION = 1

/** O que já estava no manifesto, com o `patch` por cima. */
export type ManifestPatch = Partial<ProjectManifest & { auth_skipped: boolean, url_skipped: boolean }>

function put(path: string, body: unknown): void {
  writeFileSync(join(path, 'acutis.json'), `${JSON.stringify(body, null, 4)}\n`)
}

/** @returns o `created_at` (ISO 8601) gravado no manifesto. */
export function writeManifest(path: string, name: string, slug: string): string {
  const createdAt = new Date().toISOString()

  put(path, { name, slug, created_at: createdAt, version: MANIFEST_VERSION })

  return createdAt
}

/** Grava `patch` por cima do manifesto atual. @returns o manifesto que ficou em disco. */
export function patchManifest(path: string, patch: ManifestPatch): ManifestPatch {
  const updated = { ...readManifest(path), ...patch }

  put(path, updated)

  return updated
}

/** O manifesto lido do disco, ou vazio quando o arquivo não existe ou está corrompido. */
export function readManifest(path: string): ManifestPatch {
  try {
    return JSON.parse(readFileSync(join(path, 'acutis.json'), 'utf8'))
  } catch {
    return {}
  }
}
