// @vitest-environment node
/**
 * Portado de `backend-laravel/tests/Feature/ProjectsPathTest.php`.
 *
 * O caminho relativo era resolvido contra o `base_path()` do Laravel; aqui é contra o diretório de
 * onde o processo subiu, que é o equivalente sem framework.
 */
import { afterEach, expect, it } from 'vitest'
import { acutis } from '../acutis.js'

const ORIGINAL = process.env.ACUTIS_PROJECTS_PATH

afterEach(() => {
    if (ORIGINAL === undefined) {
        delete process.env.ACUTIS_PROJECTS_PATH
    } else {
        process.env.ACUTIS_PROJECTS_PATH = ORIGINAL
    }
})

it('resolve um caminho de projetos relativo contra a raiz do processo', () => {
    process.env.ACUTIS_PROJECTS_PATH = '.acutis'

    expect(acutis().root).toBe(`${process.cwd()}/.acutis`)
})

it('deixa intocado um caminho de projetos absoluto', () => {
    process.env.ACUTIS_PROJECTS_PATH = '/srv/acutis'

    expect(acutis().root).toBe('/srv/acutis')
})
