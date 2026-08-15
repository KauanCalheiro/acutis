/**
 * O que todo teste de endpoint precisa: um diretório de projetos só dele e um app de pé.
 *
 * Equivale ao `beforeEach`/`afterEach` que os testes Pest repetiam — diretório temporário em
 * `sys_get_temp_dir()` e `config()->set('acutis.projects.path', ...)`. Aqui o caminho entra por
 * variável de ambiente, que é de onde a configuração lê.
 */
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import supertest from 'supertest'
import { ApiModule } from '../api.module.js'
import { HttpErrorFilter } from '../kernel/http-error.filter.js'
import { validationPipe } from '../kernel/validation.js'

export interface Harness {
    /** A raiz de projetos desta execução. */
    root: string
    /** O cliente HTTP contra o app de pé. */
    http: ReturnType<typeof supertest>
    /** Caminho de um projeto dentro da raiz. */
    projectPath: (slug: string) => string
    close: () => Promise<void>
}

export async function startApi(): Promise<Harness> {
    const root = mkdtempSync(join(tmpdir(), 'acutis-test-'))
    const previousRoot = process.env.ACUTIS_PROJECTS_PATH

    process.env.ACUTIS_PROJECTS_PATH = root

    const moduleRef = await Test.createTestingModule({ imports: [ApiModule] }).compile()
    const app: INestApplication = moduleRef.createNestApplication()

    app.useGlobalPipes(validationPipe())
    app.useGlobalFilters(new HttpErrorFilter())

    await app.init()

    return {
        root,
        http: supertest(app.getHttpServer()),
        projectPath: (slug: string) => join(root, slug),
        close: async () => {
            await app.close()
            rmSync(root, { recursive: true, force: true })

            if (previousRoot === undefined) {
                delete process.env.ACUTIS_PROJECTS_PATH
            } else {
                process.env.ACUTIS_PROJECTS_PATH = previousRoot
            }
        }
    }
}
