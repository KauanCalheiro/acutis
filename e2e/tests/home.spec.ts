import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const BACKEND_DIR = resolve(import.meta.dirname, '../../backend')
const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures/projects')
const BACKEND_URL = 'http://localhost:4200'
const FIXTURE_COUNT = 8

let backend: ChildProcess

async function fetchProjectsTotal(): Promise<number | null> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/projects`)
        if (!res.ok) return null
        const body = await res.json()
        return body.meta.total
    } catch {
        return null
    }
}

async function waitForBackend(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        const total = await fetchProjectsTotal()
        if (total === FIXTURE_COUNT) return
        if (total !== null) {
            throw new Error(`backend on ${BACKEND_URL} returned ${total} projects instead of the ${FIXTURE_COUNT} fixtures; stale server on the port?`)
        }
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('backend did not become healthy in time')
}

test.describe('projects home', { tag: ['@read', '@project'] }, () => {
    test.beforeAll(async () => {
        backend = spawn('php', ['artisan', 'serve', '--port=4200'], {
            cwd: BACKEND_DIR,
            stdio: 'ignore',
            env: { ...process.env, ACUTIS_PROJECTS_PATH: FIXTURES_DIR },
        })
        await waitForBackend()
    })

    test.afterAll(() => {
        backend.kill()
    })

    test.beforeEach(async ({ page }) => {
        await test.step('open home and wait for hydration', async () => {
            await page.goto('/')
            await page.locator('[data-hydrated="true"]').waitFor()
        })
    })

    test('lists the first page of projects', async ({ page }) => {
        await expect(page.getByTestId('projeto-card')).toHaveCount(6)
        await expect(page.getByTestId('projeto-card').first()).toContainText('Alpha Store')
    })

    test('search filters projects server-side', async ({ page }) => {
        await test.step('type a unique term in the search input', async () => {
            await page.getByTestId('projeto-busca').fill('zumbi')
        })

        await expect(page.getByTestId('projeto-card')).toHaveCount(1)
        await expect(page.getByTestId('projeto-card')).toContainText('Zumbi Tracker')
    })

    test('pagination navigates to the second page', async ({ page }) => {
        await test.step('go to page 2', async () => {
            await page.getByTestId('projeto-paginacao').getByRole('button', { name: 'Page 2' }).click()
        })

        await expect(page.getByTestId('projeto-card')).toHaveCount(2)
        await expect(page.getByTestId('projeto-card').first()).toContainText('Golf Panel')
    })

    test('search without matches shows the empty state', async ({ page }) => {
        await test.step('type a term that matches nothing', async () => {
            await page.getByTestId('projeto-busca').fill('xyznope')
        })

        await expect(page.getByTestId('projeto-vazio')).toBeVisible()
    })
})

test.describe('project creation', { tag: ['@write', '@project'] }, () => {
    let writeBackend: ChildProcess
    let tmpProjects: string
    let tmpGitRepo: string

    test.beforeAll(async () => {
        tmpProjects = mkdtempSync(join(tmpdir(), 'acutis-projects-'))
        cpSync(FIXTURES_DIR, tmpProjects, { recursive: true })

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

        writeBackend = spawn('php', ['artisan', 'serve', '--port=4200'], {
            cwd: BACKEND_DIR,
            stdio: 'ignore',
            env: { ...process.env, ACUTIS_PROJECTS_PATH: tmpProjects },
        })
        await waitForBackend()
    })

    test.afterAll(() => {
        writeBackend.kill()
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

        await test.step('search for the new project', async () => {
            await page.getByTestId('projeto-busca').fill('meu projeto')
        })

        await expect(page.getByTestId('projeto-card').filter({ hasText: 'Meu Projeto Novo' })).toHaveCount(1)
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

        await test.step('search for the cloned project', async () => {
            await page.getByTestId('projeto-busca').fill('clonado')
        })

        await expect(page.getByTestId('projeto-card').filter({ hasText: 'clonado-do-git' })).toHaveCount(1)
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
