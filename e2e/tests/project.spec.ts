import { test, expect } from '@playwright/test'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { startBackend } from '../support/backend'

const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures/projects')

test.describe('project page', { tag: ['@read', '@project'] }, () => {
    let stopBackend: () => Promise<void>

    test.beforeAll(async () => {
        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: FIXTURES_DIR })
    })

    test.afterAll(async () => {
        await stopBackend()
    })

    test.beforeEach(async ({ page }) => {
        await test.step('open the project page and wait for hydration', async () => {
            await page.goto('/projects/alpha-store')
            await page.locator('[data-hydrated="true"]').waitFor()
        })
    })

    test('opens from the home card', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-card').filter({ hasText: 'Alpha Store' }).click()

        await expect(page).toHaveURL('/projects/alpha-store')
    })

    test('shows the project header', async ({ page }) => {
        await expect(page.getByTestId('projeto-nome')).toHaveText('Alpha Store')
        await expect(page.getByTestId('projeto-caminho')).toContainText('alpha-store')
        await expect(page.getByTestId('projeto-origem')).toHaveText('Local')
    })

    test('returns to the home from the header button', async ({ page }) => {
        await page.getByTestId('projeto-voltar').click()

        await expect(page).toHaveURL('/')
    })

    test('lists the scenarios with their tags', async ({ page }) => {
        await expect(page.getByTestId('cenario-card')).toHaveCount(2)

        const login = page.getByTestId('cenario-card').filter({ hasText: 'Login do cliente' })
        await expect(login).toContainText('tests/login-do-cliente.spec.ts')
        await expect(login).toContainText('@read')
        await expect(login).toContainText('@login')

        const cadastro = page.getByTestId('cenario-card').filter({ hasText: 'Cadastro de produto' })
        await expect(cadastro).toContainText('@write')
        await expect(cadastro).toContainText('@admin')
    })

    test('filters the scenarios by search', async ({ page }) => {
        await page.getByTestId('cenario-busca').fill('login')

        await expect(page.getByTestId('cenario-card')).toHaveCount(1)
        await expect(page.getByTestId('cenario-card')).toContainText('Login do cliente')
    })

    test('returns 404 for an unknown project', async ({ page }) => {
        const response = await page.goto('/projects/nao-existe')

        expect(response?.status()).toBe(404)
    })
})

test.describe('project management', { tag: ['@write', '@project'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        tmpProjects = mkdtempSync(join(tmpdir(), 'acutis-projects-'))
        cpSync(FIXTURES_DIR, tmpProjects, { recursive: true })

        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
    })

    test('renames the project', async ({ page }) => {
        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('open the edit modal and save the new name', async () => {
            await page.getByTestId('projeto-editar').click()
            await page.getByTestId('projeto-form-nome').fill('Blog Renomeado')
            await page.getByTestId('projeto-form-salvar').click()
        })

        await expect(page).toHaveURL('/projects/blog-renomeado')
        await expect(page.getByTestId('projeto-nome')).toHaveText('Blog Renomeado')
    })

    test('deletes the project after confirmation', async ({ page }) => {
        await page.goto('/projects/casa-verde')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('confirm the removal', async () => {
            await page.getByTestId('projeto-remover').click()
            await page.getByTestId('projeto-remover-confirmar').click()
        })

        await expect(page).toHaveURL('/')
        expect(existsSync(join(tmpProjects, 'casa-verde'))).toBe(false)
    })
})
