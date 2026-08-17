import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startBackend } from '../support/backend'
import { PORTS } from '../support/ports'
import { projectsCopy } from '../support/projects'

test.describe('project API contract', { tag: ['@read', '@project'] }, () => {
    let backend: Server

    test.beforeAll(async () => {
        backend = createServer((_, response) => {
            response.writeHead(200, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ data: [{ slug: 42 }], meta: {} }))
        })

        await new Promise<void>((resolvePromise) => backend.listen(PORTS.webdriver, resolvePromise))
    })

    test.afterAll(async () => {
        await new Promise<void>((resolvePromise, reject) => backend.close((error) => {
            if (error) reject(error)
            else resolvePromise()
        }))
    })

    test('rejects an invalid backend response at the BFF boundary', async ({ request }) => {
        const response = await request.get('/api/projects')

        expect(response.status()).toBe(502)
        await expect(response.json()).resolves.toMatchObject({
            statusCode: 502,
            statusMessage: 'Resposta inválida da API.'
        })
    })

    test('rejects an invalid scenario response at the BFF boundary', async ({ request }) => {
        const response = await request.get('/api/projects/alpha-store/scenarios/login')

        expect(response.status()).toBe(502)
        await expect(response.json()).resolves.toMatchObject({
            statusCode: 502,
            statusMessage: 'Resposta inválida da API.'
        })
    })
})

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

    test('says the title is clickable to rename it', async ({ page }) => {
        await page.mouse.move(640, 500)

        await expect(async () => {
            await page.getByTestId('projeto-nome').hover()
            await expect(page.getByText('Clique para renomear', { exact: true }).first()).toBeVisible({ timeout: 1000 })
        }).toPass({ timeout: 10_000 })

        await expect(page.getByTestId('projeto-nome')).toHaveCSS('cursor', 'pointer')
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

    test('opens the auth scenario page from the alert', async ({ page }) => {
        await page.getByTestId('projeto-auth-configurar').click()

        await expect(page).toHaveURL('/projects/alpha-store/scenarios/auth')
        await expect(page.getByTestId('auth-intro')).toBeVisible()
    })

    test('opens the auth scenario page from the header button', async ({ page }) => {
        await page.getByTestId('projeto-auth').click()

        await expect(page).toHaveURL('/projects/alpha-store/scenarios/auth')
    })

    test('icon-only actions show an immediate tooltip on hover', async ({ page }) => {
        for (const [testid, label] of [
            ['projeto-remover', 'Remover projeto'],
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

    test('runs every scenario left by the search filter', async ({ page }) => {
        let requestedUrl: string | null = null
        await page.route('**/api/projects/alpha-store/run-stream*', async (route) => {
            requestedUrl = route.request().url()
            const events = [
                { event: 'run:started', total: 2, steps: ['Abrir a home', 'Entrar', 'Salvar o produto'] },
                { event: 'test', id: 't1', title: 'Login do cliente entra com credenciais válidas', status: 'pending', steps: ['Abrir a home', 'Entrar'] },
                { event: 'test', id: 't2', title: 'Cadastro de produto cria um produto', status: 'pending', steps: ['Salvar o produto'] },
                { event: 'step', testId: 't1', title: 'Abrir a home', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir a home', status: 'success', durationMs: 100 },
                { event: 'step', testId: 't1', title: 'Entrar', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Entrar', status: 'success', durationMs: 100 },
                { event: 'test', id: 't1', title: 'Login do cliente entra com credenciais válidas', status: 'success', durationMs: 120 },
                { event: 'step', testId: 't2', title: 'Salvar o produto', status: 'pending' },
                { event: 'step', testId: 't2', title: 'Salvar o produto', status: 'failed', durationMs: 50, error: "locator('#salvar') resolved to hidden" },
                { event: 'test', id: 't2', title: 'Cadastro de produto cria um produto', status: 'failed', durationMs: 80, error: "locator('#salvar') resolved to hidden" },
                { event: 'run:finished', status: 'failed', passed: false },
            ]
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
            })
        })

        await test.step('filter by tag and run what is on screen', async () => {
            await page.getByTestId('cenario-busca').fill('@write')

            await expect(page.getByTestId('cenario-card')).toHaveCount(1)
            await expect(page.getByTestId('projeto-rodar-filtrados')).toHaveText(/Rodar 1 filtrados/)

            await page.getByTestId('projeto-rodar-filtrados').click()
        })

        await expect(page.getByTestId('execucao-status')).toContainText('Falha')
        expect(requestedUrl).toContain('grep=Cadastro+de+produto')
        expect(requestedUrl).not.toContain('spec=')

        const tests = page.getByTestId('execucao-teste')
        await expect(tests).toHaveCount(2)
        await expect(tests.nth(0)).toHaveAttribute('data-status', 'success')
        await expect(tests.nth(1)).toHaveAttribute('data-status', 'failed')

        await test.step('offer the playwright report of the run', async () => {
            await expect(page.getByTestId('execucao-relatorio')).toHaveAttribute(
                'href',
                /\/api\/v1\/projects\/alpha-store\/report\/$/,
            )
        })

        await test.step('open the steps of the test that failed', async () => {
            await expect(tests.nth(1).getByTestId('execucao-step-erro')).toContainText("locator('#salvar') resolved to hidden")

            await tests.nth(0).getByTestId('execucao-teste-abrir').click()

            await expect(tests.nth(0).getByTestId('execucao-step-titulo')).toHaveText(['Abrir a home', 'Entrar'])
        })
    })

    test('shows the whole timeline of a scenario as soon as it is announced', async ({ page }) => {
        await page.route('**/api/projects/alpha-store/run-stream*', async (route) => {
            const events = [
                { event: 'run:started', total: 2, steps: ['Abrir a home', 'Entrar', 'Salvar o produto'] },
                { event: 'test', id: 't1', title: 'Login do cliente entra com credenciais válidas', status: 'pending', steps: ['Abrir a home', 'Entrar'] },
                { event: 'test', id: 't2', title: 'Cadastro de produto cria um produto', status: 'pending', steps: ['Salvar o produto'] },
                { event: 'step', testId: 't1', title: 'Abrir a home', status: 'pending' },
            ]
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
            })
        })

        await page.getByTestId('projeto-rodar-filtrados').click()

        const tests = page.getByTestId('execucao-teste')
        await expect(tests).toHaveCount(2)

        await test.step('open the scenario that has not started yet', async () => {
            await tests.nth(1).getByTestId('execucao-teste-abrir').click()

            const steps = tests.nth(1).getByTestId('execucao-step')
            await expect(steps).toHaveCount(1)
            await expect(steps.nth(0)).toHaveAttribute('data-status', 'waiting')
            await expect(steps.nth(0).getByTestId('execucao-step-titulo')).toHaveText('Salvar o produto')
        })

        await test.step('the scenario in progress shows what is done and what is left', async () => {
            await tests.nth(0).getByTestId('execucao-teste-abrir').click()

            const steps = tests.nth(0).getByTestId('execucao-step')
            await expect(steps).toHaveCount(2)
            await expect(steps.nth(0)).toHaveAttribute('data-status', 'running')
            await expect(steps.nth(1)).toHaveAttribute('data-status', 'waiting')
        })
    })

    test('keeps the run button disabled when the search leaves no scenario', async ({ page }) => {
        await page.getByTestId('cenario-busca').fill('não existe')

        await expect(page.getByTestId('cenario-card')).toHaveCount(0)
        await expect(page.getByTestId('projeto-rodar-filtrados')).toBeDisabled()
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

test.describe('project authentication entry', { tag: ['@write', '@project'] }, () => {
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

    test('lands on the configured login, script and all', async ({ page }) => {
        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-auth').click()
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page).toHaveURL('/projects/beta-blog/scenarios/auth')
        await page.getByTestId('cenario-tab-playwright').click()
        await expect(page.getByTestId('cenario-playwright')).toHaveValue(/login gravado/)
    })

    test('reaches the auth page from the failing alert', async ({ page }) => {
        mkdirSync(join(tmpProjects, 'beta-blog', 'runs', 'auth'), { recursive: true })
        writeFileSync(
            join(tmpProjects, 'beta-blog', 'runs', 'auth', 'history.ndjson'),
            `${JSON.stringify({ started_at: '2026-01-01T10:00:00+00:00', duration_ms: 10, passed: false, steps: [], playwright: '' })}\n`,
        )

        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-auth-revisar').click()

        await expect(page).toHaveURL('/projects/beta-blog/scenarios/auth')
    })

    test('warns that authentication is failing when the last run did not pass', async ({ page }) => {
        mkdirSync(join(tmpProjects, 'beta-blog', 'runs', 'auth'), { recursive: true })
        writeFileSync(
            join(tmpProjects, 'beta-blog', 'runs', 'auth', 'history.ndjson'),
            `${JSON.stringify({ started_at: '2026-01-01T10:00:00+00:00', duration_ms: 10, passed: false, steps: [], playwright: '' })}\n`,
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

    /** A URL vem do .env que o projectsCopy escreve; apagá-la é o que deixa o projeto sem URL nenhuma. */
    function withoutUrl(project: string): void {
        writeFileSync(join(tmpProjects, project, '.env'), '')
    }

    test('refuses something that is not a url', async ({ page }) => {
        withoutUrl('echo-docs')

        await page.goto('/projects/echo-docs')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-configuracoes-base-url').fill('nao-e-url')
        await page.getByTestId('projeto-configuracoes-salvar').click()

        await expect(page.getByText('A URL base deve ser uma URL válida.', { exact: true })).toBeVisible()
    })

    test('asks for the base url as soon as a project without one opens', async ({ page }) => {
        withoutUrl('alpha-store')

        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('the modal comes up on its own, with no button to call it', async () => {
            await expect(page.getByTestId('projeto-configuracoes-base-url')).toBeVisible()
            await expect(page.getByTestId('projeto-configuracoes')).toHaveCount(0)
        })

        await page.getByTestId('projeto-configuracoes-base-url').fill('https://sistema.exemplo.com/app')
        await page.getByTestId('projeto-configuracoes-salvar').click()

        await expect(page.getByTestId('projeto-configuracoes-salvar')).toBeHidden()

        const environment = readFileSync(join(tmpProjects, 'alpha-store', 'environments', 'ambiente.json'), 'utf8')
        expect(environment).toContain('https://sistema.exemplo.com/app')
    })

    test('shows the saved url as the URL variable of the active environment', async ({ page }) => {
        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('projeto-configuracoes-base-url')).toBeHidden()

        await page.getByTestId('projeto-ambientes').click()

        await expect(page.getByTestId('ambientes-variaveis-chave-0')).toHaveValue('URL')
        await expect(page.getByTestId('ambientes-variaveis-valor-0')).toHaveValue('https://sistema.exemplo.com/app')
    })

    test('opens the environments already loaded when the url asks for them', async ({ page }) => {
        await page.goto('/projects/alpha-store?environment')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('ambientes-variaveis-chave-0')).toHaveValue('URL', { timeout: 10_000 })
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

    test('offers the report of the last run once a run has left one', async ({ page }) => {
        await page.goto('/projects/alpha-store')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('projeto-relatorio')).toBeHidden()

        mkdirSync(join(tmpProjects, 'alpha-store/results/report'), { recursive: true })
        writeFileSync(join(tmpProjects, 'alpha-store/results/report/index.html'), '<html>relatório</html>')

        await page.reload()
        await page.locator('[data-hydrated="true"]').waitFor()

        const report = page.getByTestId('projeto-relatorio')
        await expect(report).toBeVisible()
        await expect(report).toHaveAttribute('href', /\/api\/v1\/projects\/alpha-store\/report\/$/)
        await expect(report).toHaveAttribute('target', '_blank')
    })

    test('renames the project by editing the title itself', async ({ page }) => {
        await page.goto('/projects/beta-blog')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('turn the title into a field and confirm the new name', async () => {
            await page.getByTestId('projeto-nome').click()
            await page.getByTestId('projeto-nome-campo').fill('Blog Renomeado')
            await page.getByTestId('projeto-nome-confirmar').click()
        })

        await expect(page).toHaveURL('/projects/blog-renomeado')
        await expect(page.getByTestId('projeto-nome')).toHaveText('Blog Renomeado')
        await expect(page.getByTestId('projeto-nome-campo')).toBeHidden()
    })

    test('cancels the rename and brings the previous name back', async ({ page }) => {
        await page.goto('/projects/echo-docs')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('projeto-nome').click()
        await page.getByTestId('projeto-nome-campo').fill('Nome Que Não Vai Valer')
        await page.getByTestId('projeto-nome-cancelar').click()

        await expect(page).toHaveURL('/projects/echo-docs')
        await expect(page.getByTestId('projeto-nome')).toHaveText('Echo Docs')

        await test.step('and the field opens again with the name that is actually saved', async () => {
            await page.getByTestId('projeto-nome').click()

            await expect(page.getByTestId('projeto-nome-campo')).toHaveValue('Echo Docs')
        })
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
