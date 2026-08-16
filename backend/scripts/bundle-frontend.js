#!/usr/bin/env node
/**
 * Traz o frontend compilado para dentro do pacote do CLI.
 *
 * O `.output` do Nuxt é autocontido — ele já embute as dependências que usa — então copiá-lo para
 * `backend/frontend/` é o suficiente para o `bin` subir a interface com um `node` e nada mais.
 * Copiar, e não referenciar por caminho relativo, é o que faz o pacote funcionar depois de
 * publicado, onde o diretório `frontend/` do repositório não existe.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

// O banner desenha a logo a partir do mesmo path do frontend. O código-fonte do Nuxt não vai
// no pacote, então a string é extraída aqui e gravada ao lado do bin — assim continua havendo
// um só desenho no repositório, e o build é quem carrega a cópia para dentro do pacote.
const LOGO_SOURCE = join(BACKEND, '../frontend/app/utils/logo.ts')
const LOGO_TARGET = join(BACKEND, 'bin/logo-path.js')
const logoPath = readFileSync(LOGO_SOURCE, 'utf8').match(/logoPath = '([^']+)'/)?.[1]

if (!logoPath) {
    console.error(`==> não achei o logoPath em ${LOGO_SOURCE}`)
    process.exit(1)
}

writeFileSync(LOGO_TARGET, `// Gerado por scripts/bundle-frontend.js a partir do frontend. Não edite.\nexport const logoPath = '${logoPath}'\n`)

console.log(`==> logo do banner gravada em ${LOGO_TARGET}`)
