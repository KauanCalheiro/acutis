import { test, expect } from '@playwright/test'
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { startBackend } from '../support/backend'

const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures/projects')

test.describe('scenario detail page', { tag: ['@read', '@scenario'] }, () => {
    let stopBackend: () => Promise<void>

    test.beforeAll(async () => {
        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: FIXTURES_DIR })
    })

    test.afterAll(async () => {
        await stopBackend()
    })

    test.beforeEach(async ({ page }) => {
        await test.step('open the scenario detail page from the project card', async () => {
            await page.goto('/projects/alpha-store')
            await page.locator('[data-hydrated="true"]').waitFor()

            await page.getByTestId('cenario-card').filter({ hasText: 'Login do cliente' }).click()
            await page.locator('[data-hydrated="true"]').waitFor()
        })
    })

    test('navigates from the scenario card', async ({ page }) => {
        await expect(page).toHaveURL('/projects/alpha-store/scenarios/login-do-cliente')
    })

    test('shows the scenario header', async ({ page }) => {
        await expect(page.getByTestId('cenario-titulo')).toHaveText('Login do cliente')
        await expect(page.getByTestId('cenario-caminho')).toHaveText('tests/login-do-cliente.spec.ts')
        await expect(page.getByTestId('cenario-tags')).toContainText('@read')
        await expect(page.getByTestId('cenario-tags')).toContainText('@login')
    })

    test('returns to the project page from the header button', async ({ page }) => {
        await page.getByTestId('cenario-voltar').click()

        await expect(page).toHaveURL('/projects/alpha-store')
    })

    test('switches between the eventos, gherkin and playwright tabs', async ({ page }) => {
        await expect(page.getByTestId('cenario-eventos')).toContainText('Abrir página de login')

        await page.getByTestId('cenario-tab-gherkin').click()
        await expect(page.getByTestId('cenario-gherkin')).toHaveValue(/Funcionalidade: Login do cliente/)

        await page.getByTestId('cenario-tab-playwright').click()
        await expect(page.getByTestId('cenario-playwright')).toHaveValue(/Login do cliente/)

        await page.getByTestId('cenario-tab-eventos').click()
        await expect(page.getByTestId('cenario-eventos')).toBeVisible()
    })
})

test.describe('scenario management', { tag: ['@write', '@scenario'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        tmpProjects = mkdtempSync(join(tmpdir(), 'acutis-projects-'))
        cpSync(FIXTURES_DIR, tmpProjects, { recursive: true })

        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    // cada teste mexe/apaga cenários do alpha-store — reseta a pasta antes de
    // cada um pra não depender da ordem de execução nem do que o teste anterior mudou
    test.beforeEach(() => {
        rmSync(join(tmpProjects, 'alpha-store'), { recursive: true, force: true })
        cpSync(join(FIXTURES_DIR, 'alpha-store'), join(tmpProjects, 'alpha-store'), { recursive: true })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
    })

    test('deletes the scenario after confirmation', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('confirm the removal', async () => {
            await page.getByTestId('cenario-excluir').click()
            await expect(page.getByRole('dialog')).toContainText('"Login do cliente"')
            await expect(page.getByRole('dialog').locator('b')).toHaveText('apaga')
            await page.getByTestId('cenario-excluir-confirmar').click()
        })

        await expect(page).toHaveURL('/projects/alpha-store')
        expect(existsSync(join(tmpProjects, 'alpha-store', 'tests', 'login-do-cliente.spec.ts'))).toBe(false)
        expect(existsSync(join(tmpProjects, 'alpha-store', 'features', 'login-do-cliente.feature'))).toBe(false)
    })

    test('edits the scenario content without renaming it', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('change the title and save', async () => {
            await page.getByTestId('cenario-editar').click()
            await page.getByTestId('contexto-titulo').fill('Login do cliente atualizado')
            await page.getByTestId('cenario-editar-salvar').click()
        })

        await expect(page).toHaveURL('/projects/alpha-store/scenarios/login-do-cliente')
        await expect(page.getByTestId('cenario-titulo')).toHaveText('Login do cliente atualizado')
    })

    test('renames the scenario and navigates to the new url', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('change the file/domain and save', async () => {
            await page.getByTestId('cenario-editar').click()
            await page.getByTestId('contexto-path').fill('entrar')
            await page.getByTestId('contexto-dominio').fill('auth')
            await page.getByTestId('cenario-editar-salvar').click()
        })

        await expect(page).toHaveURL('/projects/alpha-store/scenarios/auth/entrar')
        expect(existsSync(join(tmpProjects, 'alpha-store', 'tests', 'login-do-cliente.spec.ts'))).toBe(false)
        expect(existsSync(join(tmpProjects, 'alpha-store', 'tests', 'auth', 'entrar.spec.ts'))).toBe(true)
    })

    test('shows an error when renaming onto a scenario that already exists', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('cenario-editar').click()
        await page.getByTestId('contexto-path').fill('cadastro-de-produto')
        await page.getByTestId('cenario-editar-salvar').click()

        await expect(page.getByRole('dialog')).toContainText('Já existe um cenário')
        await expect(page).toHaveURL('/projects/alpha-store/scenarios/login-do-cliente')
    })

    test('suggests test ids for the events without one', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('cenario-sugestoes').click()
        await expect(page.getByTestId('sugestoes-carregando')).toBeHidden({ timeout: 20_000 })

        const cards = page.getByTestId('sugestao-card')
        await expect(cards.first()).toBeVisible()
        await expect(cards.first().getByTestId('sugestao-testid')).toContainText('data-testid="')
    })

    test('shows the real backend message when suggestions fail', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.route('**/api/projects/alpha-store/scenario-suggestions', (route) => route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ data: { message: 'O provedor de IA não respondeu a tempo.' } }),
        }))

        await page.getByTestId('cenario-sugestoes').click()

        await expect(page.getByRole('dialog')).toContainText('O provedor de IA não respondeu a tempo.')
    })

    test('runs the scenario test and shows the result', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        let requestedUrl: string | null = null
        await page.route('**/api/projects/alpha-store/run-stream*', async (route) => {
            requestedUrl = route.request().url()
            const events = [
                { event: 'run:started', total: 1, steps: ['Abrir página de login', 'Entrar com usuário/código', 'Ver o painel'] },
                { event: 'test', id: 't1', title: 'login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir página de login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir página de login', status: 'success', durationMs: 100 },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'failed', durationMs: 50, error: 'Timed out waiting for element' },
                { event: 'test', id: 't1', title: 'login', status: 'failed', durationMs: 150, error: 'Timed out waiting for element', videoPath: '/tmp/acutis-run/test-results/login/video.webm' },
                { event: 'run:finished', status: 'failed', passed: false },
            ]
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
            })
        })

        await page.getByTestId('cenario-testar').click()

        const steps = page.getByTestId('execucao-step')
        await expect(steps).toHaveCount(2)
        await expect(page.getByRole('dialog')).not.toContainText('Ver o painel')
        await expect(steps.nth(0).getByTestId('execucao-step-titulo')).toHaveText('Abrir página de login')
        await expect(steps.nth(0).locator('[class*="text-success"]')).toBeVisible()
        await expect(steps.nth(1).getByTestId('execucao-step-titulo')).toHaveText('Entrar com usuário/código')
        await expect(steps.nth(1).locator('[class*="text-error"]').first()).toBeVisible()
        await expect(steps.nth(1).getByTestId('execucao-step-erro')).toContainText('Timed out waiting for element')

        await expect(page.getByTestId('execucao-status')).toContainText('Falha')
        await expect(page.getByRole('dialog')).toContainText('Login do cliente')
        await expect(page.getByRole('dialog')).toContainText('Alpha Store')

        await expect(page.getByTestId('execucao-fechar')).toBeVisible()
        await expect(page.getByTestId('execucao-video')).toHaveAttribute('src', /runner\/video\?path=/)

        expect(requestedUrl).toContain('spec=tests%2Flogin-do-cliente.spec.ts')
    })

    test('seeds the whole timeline as waiting before the steps run', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.route('**/api/projects/alpha-store/run-stream*', async (route) => {
            const events = [
                { event: 'run:started', total: 1, steps: ['Abrir página de login', 'Entrar com usuário/código', 'Ver o painel'] },
            ]
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
            })
        })

        await page.getByTestId('cenario-testar').click()

        const steps = page.getByTestId('execucao-step')
        await expect(steps).toHaveCount(3)
        await expect(steps.nth(0).getByTestId('execucao-step-titulo')).toHaveText('Abrir página de login')
        await expect(steps.nth(2).getByTestId('execucao-step-titulo')).toHaveText('Ver o painel')

        for (const i of [0, 1, 2]) {
            await expect(steps.nth(i)).toHaveAttribute('data-status', 'waiting')
        }
    })
})
