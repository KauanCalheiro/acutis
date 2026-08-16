import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { startBackend } from '../support/backend'

const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures/projects')

/** Quanto o documento passa da altura visível: a Home pede só os cards que couberem. */
const overflowOf = (page: Page) => () => page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
)

/**
 * Uma cópia das fixtures, sem a `runtime` que uma execução anterior possa ter deixado: é onde o
 * backend guarda banco e logs, e herdá-la faria uma rodada enxergar a configuração da outra.
 */
function fixturesCopy(): string {
    const dir = mkdtempSync(join(tmpdir(), 'acutis-projects-'))

    cpSync(FIXTURES_DIR, dir, { recursive: true, filter: (source) => basename(source) !== 'runtime' })

    return dir
}

test.describe('projects home', { tag: ['@read', '@project'] }, () => {
    let stopBackend: () => Promise<void>
    let projects: string

    // Apontar o backend para as próprias fixtures faz ele criar `runtime` dentro delas, sujando o
    // repositório a cada execução. Todo spec roda sobre uma cópia.
    test.beforeAll(async () => {
        projects = fixturesCopy()
        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: projects })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(projects, { recursive: true, force: true })
    })

    test.beforeEach(async ({ page }) => {
        await test.step('open home and wait for hydration', async () => {
            await page.goto('/')
            await page.locator('[data-hydrated="true"]').waitFor()
        })
    })

    test('lists the projects that fit the screen without scrolling the page', async ({ page }) => {
        await expect(page.getByTestId('projeto-card').first()).toContainText('Alpha Store')

        await expect.poll(overflowOf(page)).toBeLessThan(2)
    })

    test('fits more cards on a taller screen', async ({ page }) => {
        await expect.poll(overflowOf(page)).toBeLessThan(2)
        const short = await page.getByTestId('projeto-card').count()

        await test.step('grow the viewport', async () => {
            await page.setViewportSize({ width: 1280, height: 1400 })
        })

        await expect.poll(() => page.getByTestId('projeto-card').count()).toBeGreaterThan(short)
    })

    test('local projects show the local origin badge', async ({ page }) => {
        await expect(page.getByTestId('projeto-card').first().getByTestId('projeto-origem')).toHaveText('Local')
    })

    test('shows one of the rotating taglines', async ({ page }) => {
        const tagline = await page.getByTestId('projeto-frase').innerText()
        expect(tagline.trim()).not.toBe('')

        const seen = new Set([tagline])
        for (let i = 0; i < 15 && seen.size === 1; i++) {
            await page.reload()
            await page.locator('[data-hydrated="true"]').waitFor()
            seen.add(await page.getByTestId('projeto-frase').innerText())
        }

        expect(seen.size).toBeGreaterThan(1)
    })

    test('retypes a new tagline in place without reloading', async ({ page }) => {
        const first = await page.getByTestId('projeto-frase').innerText()

        await expect
            .poll(async () => {
                const current = await page.getByTestId('projeto-frase').innerText()
                return current !== first && current.length > 10
            }, { timeout: 20000 })
            .toBe(true)
    })

    test('search filters projects server-side', async ({ page }) => {
        await test.step('type a unique term in the search input', async () => {
            await page.getByTestId('projeto-busca').fill('zumbi')
        })

        await expect(page.getByTestId('projeto-card')).toHaveCount(1)
        await expect(page.getByTestId('projeto-card')).toContainText('Zumbi Tracker')
    })

    test('pagination navigates to the second page', async ({ page }) => {
        await expect.poll(overflowOf(page)).toBeLessThan(2)

        await test.step('go to page 2', async () => {
            await page.getByTestId('projeto-paginacao').getByRole('button', { name: 'Page 2' }).click()
        })

        await expect(page.getByTestId('projeto-card').last()).toContainText('Zumbi Tracker')
    })

    test('centers the content vertically when it does not fill a tall screen', async ({ page }) => {
        const height = 1400

        await test.step('grow the viewport and leave a single project on screen', async () => {
            await page.setViewportSize({ width: 1280, height })
            await page.getByTestId('projeto-busca').fill('zumbi')
            await expect(page.getByTestId('projeto-card')).toHaveCount(1)
        })

        const box = await page.locator('[data-hydrated="true"]').boundingBox()

        expect(Math.abs((box!.y + box!.height / 2) - height / 2)).toBeLessThan(4)
    })

    test('search without matches shows the empty state', async ({ page }) => {
        await test.step('type a term that matches nothing', async () => {
            await page.getByTestId('projeto-busca').fill('xyznope')
        })

        await expect(page.getByTestId('projeto-vazio')).toBeVisible()
    })
})

test.describe('project creation', { tag: ['@write', '@project'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string
    let tmpGitRepo: string

    test.beforeAll(async () => {
        tmpProjects = fixturesCopy()

        tmpGitRepo = join(mkdtempSync(join(tmpdir(), 'acutis-git-')), 'clonado-do-git')
        for (const args of [
            ['init', tmpGitRepo],
            ['-C', tmpGitRepo, 'commit', '--allow-empty', '-m', 'init'],
        ]) {
            const git = spawn('git', args, {
                stdio: 'ignore',
                env: {
                    ...process.env,
                    GIT_AUTHOR_NAME: 'e2e',
                    GIT_AUTHOR_EMAIL: 'e2e@test',
                    GIT_COMMITTER_NAME: 'e2e',
                    GIT_COMMITTER_EMAIL: 'e2e@test',
                },
            })
            await new Promise((resolveExit) => git.on('exit', resolveExit))
        }

        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
        rmSync(resolve(tmpGitRepo, '..'), { recursive: true, force: true })
    })

    test.beforeEach(async ({ page }) => {
        await test.step('open home and wait for hydration', async () => {
            await page.goto('/')
            await page.locator('[data-hydrated="true"]').waitFor()
        })

        await test.step('open the creation modal', async () => {
            await page.getByTestId('projeto-adicionar').click()
            await page.getByTestId('projeto-form-nome').waitFor()
        })
    })

    test('creates a project from the template', async ({ page }) => {
        await test.step('fill the name and save', async () => {
            await page.getByTestId('projeto-form-nome').fill('Meu Projeto Novo')
            await page.getByTestId('projeto-form-salvar').click()
        })

        await expect(page.getByTestId('projeto-form-nome')).toBeHidden()

        await expect(page, 'criar já entra no projeto').toHaveURL('/projects/meu-projeto-novo')
        await expect(page.getByTestId('projeto-nome')).toContainText('Meu Projeto Novo')
    })

    test('hides the header close button when the modal has a cancel action', async ({ page }) => {
        await expect(page.getByRole('dialog').getByRole('button', { name: 'Close' })).toHaveCount(0)
    })

    test('rejects an empty name client-side', async ({ page }) => {
        await page.getByTestId('projeto-form-salvar').click()

        await expect(page.getByTestId('projeto-form')).toContainText('O nome é obrigatório.')
        await expect(page.getByTestId('projeto-form-nome')).toBeVisible()
    })

    test('shows the backend error for a duplicate name', async ({ page }) => {
        await test.step('fill the name of an existing project and save', async () => {
            await page.getByTestId('projeto-form-nome').fill('Alpha Store')
            await page.getByTestId('projeto-form-salvar').click()
        })

        await expect(page.getByTestId('projeto-form')).toContainText('Já existe um projeto com este nome.')
        await expect(page.getByTestId('projeto-form-nome')).toBeVisible()
    })

    test('clones a project from a git repository', async ({ page }) => {
        await test.step('switch to the git tab and fill the repository url', async () => {
            await page.getByTestId('projeto-form-tab-git').click()
            await page.getByTestId('projeto-form-url').fill(tmpGitRepo)
            await page.getByTestId('projeto-form-salvar').click()
        })

        await expect(page.getByTestId('projeto-form-url')).toBeHidden({ timeout: 15000 })

        await expect(page, 'clonar já entra no projeto').toHaveURL('/projects/clonado-do-git')
        await expect(page.getByTestId('projeto-origem')).toHaveText('Git')
        await expect(page.getByTestId('projeto-caminho')).toHaveText(`${tmpProjects}/clonado-do-git`)
    })

    test('rejects an empty repository url client-side', async ({ page }) => {
        await page.getByTestId('projeto-form-tab-git').click()
        await page.getByTestId('projeto-form-salvar').click()

        await expect(page.getByTestId('projeto-form')).toContainText('A URL do repositório é obrigatória.')
    })

    test('requires the token when token auth is selected', async ({ page }) => {
        await test.step('fill the url and pick token auth', async () => {
            await page.getByTestId('projeto-form-tab-git').click()
            await page.getByTestId('projeto-form-url').fill('https://example.com/repo.git')
            await page.getByTestId('projeto-form-auth').click()
            await page.getByRole('option', { name: 'Token' }).click()
            await page.getByTestId('projeto-form-salvar').click()
        })

        await expect(page.getByTestId('projeto-form')).toContainText('O token é obrigatório para autenticação por token.')
    })

    test('detects a public repository automatically', async ({ page }) => {
        await test.step('fill the url of an accessible repository', async () => {
            await page.getByTestId('projeto-form-tab-git').click()
            await page.getByTestId('projeto-form-url').fill(tmpGitRepo)
        })

        await expect(page.getByTestId('projeto-form-publico')).toBeVisible({ timeout: 15000 })
        await expect(page.getByTestId('projeto-form-auth')).toBeHidden()
    })

    test('preselects token auth for an inaccessible https repository', async ({ page }) => {
        await test.step('fill an https url that rejects anonymous access', async () => {
            await page.getByTestId('projeto-form-tab-git').click()
            await page.getByTestId('projeto-form-url').fill('https://localhost:9/privado.git')
        })

        await expect(page.getByTestId('projeto-form-token')).toBeVisible({ timeout: 15000 })
        await expect(page.getByTestId('projeto-form-publico')).toBeHidden()
    })

    test('shows the backend error when cloning into an existing name', async ({ page }) => {
        await test.step('clone with the name of an existing project', async () => {
            await page.getByTestId('projeto-form-tab-git').click()
            await page.getByTestId('projeto-form-url').fill(tmpGitRepo)
            await page.getByTestId('projeto-form-git-nome').fill('Alpha Store')
            await page.getByTestId('projeto-form-salvar').click()
        })

        await expect(page.getByTestId('projeto-form')).toContainText('Já existe um projeto com este nome.')
        await expect(page.getByTestId('projeto-form-url')).toBeVisible()
    })

    test('cancel closes the modal without creating', async ({ page }) => {
        await test.step('fill a name but cancel', async () => {
            await page.getByTestId('projeto-form-nome').fill('Projeto Cancelado')
            await page.getByTestId('projeto-form-cancelar').click()
        })

        await expect(page.getByTestId('projeto-form-nome')).toBeHidden()

        await test.step('search for the cancelled project', async () => {
            await page.getByTestId('projeto-busca').fill('cancelado')
        })

        await expect(page.getByTestId('projeto-vazio')).toBeVisible()
    })
})
