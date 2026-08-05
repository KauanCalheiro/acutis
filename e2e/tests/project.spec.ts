import { test, expect } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startBackend } from '../support/backend'
import { projectsCopy } from '../support/projects'

test.describe('project page', { tag: ['@read', '@project'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        tmpProjects = projectsCopy()

        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
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

    test('shows the authentication button in the header', async ({ page }) => {
        await expect(page.getByTestId('projeto-auth')).toBeVisible()
    })

    test('links the vscode button to the project folder on the host', async ({ page }) => {
        await expect(page.getByTestId('projeto-vscode')).toHaveAttribute('href', `vscode://file${join(tmpProjects, 'alpha-store')}`)
    })

    test('shows an alert when the project has no authentication configured', async ({ page }) => {
        await expect(page.getByTestId('projeto-auth-aviso')).toBeVisible()
    })

    test('opens the auth modal from the alert', async ({ page }) => {
        await page.getByTestId('projeto-auth-configurar').click()

        await expect(page.getByTestId('auth-gerar')).toBeVisible()
    })

    test('icon-only actions show an immediate tooltip on hover', async ({ page }) => {
        for (const [testid, label] of [
            ['projeto-remover', 'Remover projeto'],
            ['projeto-editar', 'Renomear projeto'],
            ['projeto-configuracoes', 'Configurações'],
            ['projeto-voltar', 'Voltar'],
            ['projeto-vscode', 'Abrir no VS Code'],
        ] as const) {
            await page.mouse.move(640, 500)
            await expect(async () => {
                await page.getByTestId(testid).hover()
                await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 1000 })
            }).toPass({ timeout: 10_000 })
        }
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

    test('shows the empty state with a single card when the project has no scenarios', async ({ page }) => {
        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('cenario-vazio')).toBeVisible()
        await expect(page.getByTestId('cenario-vazio-gravar')).toBeVisible()
        await expect(page.getByTestId('cenario-card')).toHaveCount(0)
    })
})

test.describe('project authentication modal', { tag: ['@write', '@project'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        tmpProjects = projectsCopy()

        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
    })

    test.beforeEach(async ({ page }) => {
        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()
    })

    test('loads the existing script when authentication is already configured', async ({ page }) => {
        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-auth').click()

        await expect(page.getByTestId('auth-script')).toHaveValue(/login gravado/)
    })

    test('edits and saves the existing script', async ({ page }) => {
        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-auth').click()
        await page.getByTestId('auth-editar').click()
        await page.getByTestId('auth-script-editor').fill('conteudo editado pelo usuario')
        await page.getByTestId('auth-salvar').click()

        await expect(page.getByTestId('auth-script')).toHaveValue('conteudo editado pelo usuario')
    })

    test('returns to the intro when "record again" is chosen', async ({ page }) => {
        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-auth').click()
        await page.getByTestId('auth-gravar-novamente').click()

        await expect(page.getByTestId('auth-gerar')).toBeVisible()
    })

    test('offers running the configured login without recording it again', async ({ page }) => {
        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-auth').click()
        await expect(page.getByTestId('auth-testar')).toBeVisible()

        await page.getByTestId('auth-testar').click()

        await test.step('the auth modal gives way to the run modal', async () => {
            await expect(page.getByTestId('auth-testar')).toBeHidden()
            await expect(page.getByTestId('execucao-detalhes').or(page.getByTestId('execucao-iniciando'))).toBeVisible({ timeout: 15_000 })
        })
    })

    test('cancel closes the modal without starting a recording', async ({ page }) => {
        await page.getByTestId('projeto-auth').click()
        await page.getByTestId('auth-cancelar').click()

        await expect(page.getByTestId('auth-gerar')).toBeHidden()
        await expect(page.getByTestId('cenario-parar')).toBeHidden()
    })

    test('warns that authentication is failing when the last run did not pass', async ({ page }) => {
        mkdirSync(join(tmpProjects, 'beta-blog', 'runs', 'auth'), { recursive: true })
        writeFileSync(
            join(tmpProjects, 'beta-blog', 'runs', 'auth', '2026-01-01T10-00-00.000000Z-aaaa.json'),
            JSON.stringify({ started_at: '2026-01-01T10:00:00+00:00', duration_ms: 10, passed: false, steps: [], playwright: '' }),
        )

        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('projeto-auth-falhando')).toBeVisible()
        await expect(page.getByTestId('projeto-auth-aviso')).toBeHidden()
    })
})

test.describe('project settings', { tag: ['@write', '@project'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        tmpProjects = projectsCopy()

        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
    })

    test('saves the base url of the system under test', async ({ page }) => {
        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('open the settings from the header and save a url', async () => {
            await page.getByTestId('projeto-configuracoes').click()
            await page.getByTestId('projeto-configuracoes-base-url').fill('https://sistema.exemplo.com/app')
            await page.getByTestId('projeto-configuracoes-salvar').click()
        })

        await expect(page.getByTestId('projeto-configuracoes-salvar')).toBeHidden()

        const environment = readFileSync(join(tmpProjects, 'alpha-store', 'environments', 'ambiente.json'), 'utf8')
        expect(environment).toContain('https://sistema.exemplo.com/app')
    })

    test('reopens showing the url already saved', async ({ page }) => {
        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-configuracoes').click()

        await expect(page.getByTestId('projeto-configuracoes-base-url')).toHaveValue('https://sistema.exemplo.com/app')
    })

    test('refuses something that is not a url', async ({ page }) => {
        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-configuracoes').click()
        await page.getByTestId('projeto-configuracoes-base-url').fill('nao-e-url')
        await page.getByTestId('projeto-configuracoes-salvar').click()

        await expect(page.getByText('A URL base deve ser uma URL válida.', { exact: true })).toBeVisible()
    })
})

test.describe('project management', { tag: ['@write', '@project'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        tmpProjects = projectsCopy()

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

    test('dismisses the alert when the project does not need login', async ({ page }) => {
        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-auth-dispensar').click()

        await expect(page.getByTestId('projeto-auth-aviso')).toBeHidden()

        await page.reload()
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('projeto-auth-aviso')).toBeHidden()
        await expect(page.getByTestId('projeto-auth')).toBeVisible()
    })

    test('hides the alert once authentication is configured', async ({ page }) => {
        mkdirSync(join(tmpProjects, 'alpha-store', 'tests'), { recursive: true })
        writeFileSync(
            join(tmpProjects, 'alpha-store', 'tests', 'auth.setup.ts'),
            'import { test as setup } from "@playwright/test"',
        )

        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('projeto-auth-aviso')).toBeHidden()
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
