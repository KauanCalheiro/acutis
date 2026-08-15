#!/usr/bin/env node
/**
 * Traz o frontend compilado para dentro do pacote do CLI.
 *
 * O `.output` do Nuxt é autocontido — ele já embute as dependências que usa — então copiá-lo para
 * `backend/frontend/` é o suficiente para o `bin` subir a interface com um `node` e nada mais.
 * Copiar, e não referenciar por caminho relativo, é o que faz o pacote funcionar depois de
 * publicado, onde o diretório `frontend/` do repositório não existe.
 */
import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(BACKEND, '../frontend/.output')
const TARGET = join(BACKEND, 'frontend')

if (!existsSync(SOURCE)) {
    console.error('==> frontend/.output não existe. Rode `pnpm --dir ../frontend build` antes.')
    process.exit(1)
}

rmSync(TARGET, { recursive: true, force: true })
cpSync(SOURCE, TARGET, { recursive: true })

console.log(`==> frontend copiado para ${TARGET}`)
