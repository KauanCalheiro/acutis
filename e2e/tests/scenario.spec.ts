import { test, expect } from '@playwright/test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { BACKEND_URL, startBackend } from '../support/backend'
import { projectReset, projectsCopy } from '../support/projects'

test.describe('scenario detail page', { tag: ['@read', '@scenario'] }, () => {
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

    /** A timeline de eventos fala como a da execução: verbo e alvo, não o nome cru do evento. */
    test('describes each recorded event in the same words the run timeline uses', async ({ page }) => {
        const eventos = page.getByTestId('cenario-eventos')

        await expect(eventos, 'a tela é dita pelo caminho, que é o que a distingue das outras').toContainText('Navega para "/login"')
        await expect(eventos).toContainText('Clica em "Entrar com usuário/código"')
        await expect(eventos).toContainText('Preenche "Usuário ou código" com "ana.lasta"')
    })

    /** Fora da revisão não há vídeo, e sem vídeo o instante de cada evento seria sempre 0.0s. */
    test('drops the timestamps of the events when there is no video to seek', async ({ page }) => {
        await expect(page.getByTestId('cenario-eventos')).not.toContainText('0.0s')
    })

    test('switches between the eventos, gherkin and playwright tabs', async ({ page }) => {
        await expect(page.getByTestId('cenario-eventos')).toContainText('Navega para "/login"')

        await page.getByTestId('cenario-tab-gherkin').click()
        await expect(page.getByTestId('cenario-gherkin')).toHaveValue(/Funcionalidade: Login do cliente/)

        await page.getByTestId('cenario-tab-playwright').click()
        await expect(page.getByTestId('cenario-playwright')).toHaveValue(/Login do cliente/)

        await page.getByTestId('cenario-tab-eventos').click()
        await expect(page.getByTestId('cenario-eventos')).toBeVisible()
    })

    /** O Gherkin é opcional: sem arquivo .feature a aba não existe, em vez de existir dizendo "vazio". */
    test('shows an empty state for a scenario without events or runs, and no gherkin tab at all', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/cadastro-de-produto')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('cenario-eventos-vazio')).toContainText('Nenhum evento gravado')

        await expect(page.getByTestId('cenario-tab-gherkin')).toBeHidden()

        await page.getByTestId('cenario-tab-playwright').click()
        await expect(page.getByTestId('cenario-playwright')).toHaveValue(/./)

        await page.getByTestId('cenario-tab-execucoes').click()
        await expect(page.getByTestId('cenario-execucoes-vazio')).toContainText('Nenhum teste executado ainda')
    })

    test('lists the persisted runs, newest first, one page at a time', async ({ page }) => {
        await page.getByTestId('cenario-tab-execucoes').click()

        const runs = page.getByTestId('cenario-execucao')

        await expect(runs).toHaveCount(6)
        await expect(runs.nth(0)).toHaveAttribute('data-status', 'success')
        await expect(runs.nth(0)).toContainText('13/06/2026')
        await expect(runs.nth(1)).toHaveAttribute('data-status', 'failed')
        await expect(runs.nth(1)).toContainText('12/06/2026')
    })

    test('shows how long each run took, which is what tells a slow run from a fast one', async ({ page }) => {
        await page.getByTestId('cenario-tab-execucoes').click()

        await expect(page.getByTestId('cenario-execucao').nth(0)).toContainText('3,8s')
    })

    test('pages through the runs that do not fit the first page', async ({ page }) => {
        await page.getByTestId('cenario-tab-execucoes').click()
        await page.getByTestId('execucoes-paginacao').getByRole('button', { name: '2' }).click()

        const runs = page.getByTestId('cenario-execucao')

        await expect(runs).toHaveCount(4)
        await expect(runs.nth(3)).toContainText('10/06/2026')
    })

    test('searches the runs by branch, by author and by the step that failed', async ({ page }) => {
        await page.getByTestId('cenario-tab-execucoes').click()

        const busca = page.getByTestId('execucoes-busca')
        const runs = page.getByTestId('cenario-execucao')

        await test.step('a branch narrows the list to the runs made on it', async () => {
            await busca.fill('feat/checkout')
            await expect(runs).toHaveCount(3)
        })

        await test.step('the title of the failed step finds the run that broke', async () => {
            await busca.fill('Confirmar o pedido')
            await expect(runs).toHaveCount(1)
            await expect(runs.nth(0)).toHaveAttribute('data-status', 'failed')
        })

        await test.step('a search that matches nothing says so instead of showing an empty grid', async () => {
            await busca.fill('feat/inexistente')
            await expect(runs).toHaveCount(0)
            await expect(page.getByTestId('cenario-execucoes-sem-resultado')).toBeVisible()
        })
    })

    test('filters the runs by status, which is how a regression gets found', async ({ page }) => {
        await page.getByTestId('cenario-tab-execucoes').click()
        await page.getByTestId('execucoes-status').click()
        await page.getByRole('option', { name: 'Falha' }).click()

        const runs = page.getByTestId('cenario-execucao')

        await expect(runs).toHaveCount(3)
        await expect(runs.nth(0)).toHaveAttribute('data-status', 'failed')
        await expect(runs.nth(2)).toHaveAttribute('data-status', 'failed')
    })

    test('opens a persisted run with its timeline and the code that ran', async ({ page }) => {
        await page.getByTestId('cenario-tab-execucoes').click()
        await page.getByTestId('cenario-execucao').nth(1).click()

        await expect(page.getByTestId('execucao-status')).toContainText('Falha')

        const steps = page.getByTestId('execucao-step')
        await expect(steps).toHaveCount(3)
        await expect(steps.nth(1).getByTestId('execucao-step-erro')).toContainText("locator('#v-0') resolved to hidden")
        await expect(steps.nth(2)).toHaveAttribute('data-status', 'waiting')

        await expect(page.getByTestId('execucao-playwright')).toHaveValue(/test\.describe\('Login do cliente'/)
        await expect(page.getByTestId('execucao-video')).toBeHidden()
        await expect(page.getByTestId('execucao-corrigir'), 'execução falha guardada também oferece correção').toBeVisible()
    })
})

test.describe('auth scenario page', { tag: ['@read', '@scenario'] }, () => {
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

    test('shows the configured login as a scenario of its own', async ({ page }) => {
        await page.goto('/projects/beta-blog/scenarios/auth')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('cenario-titulo')).toHaveText('Autenticação')
        await expect(page.getByTestId('cenario-caminho')).toHaveText('tests/auth.setup.ts')

        await page.getByTestId('cenario-tab-playwright').click()
        await expect(page.getByTestId('cenario-playwright')).toHaveValue(/login gravado/)
    })

    test('offers recording again and testing, but never deleting', async ({ page }) => {
        await page.goto('/projects/beta-blog/scenarios/auth')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('auth-gravar')).toHaveText(/Gravar novamente/)
        await expect(page.getByTestId('cenario-testar')).toBeVisible()
        await expect(page.getByTestId('cenario-excluir')).toBeHidden()
        await expect(page.getByTestId('cenario-sugestoes')).toBeHidden()
    })

    test('invites the recording when the project has no login yet', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/auth')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('auth-intro')).toContainText('Vamos gravar o login de verdade')
        await expect(page.getByTestId('auth-gravar-vazio')).toBeVisible()
        await expect(page.getByTestId('cenario-testar')).toBeHidden()
        await expect(page.getByTestId('cenario-editar')).toBeHidden()
    })

    test('says the login is configured without anyone going back to the project page', async ({ page }) => {
        await page.goto('/projects/beta-blog/scenarios/auth')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('cenario-auth-status')).toHaveText('Configurada')
    })

    test('says nothing about a login that was never configured, since the empty state already does', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/auth')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('cenario-auth-status')).toBeHidden()
    })
})

/** Sem provedor de IA os botões que chamariam um modelo desabilitam, mas nunca somem. */
test.describe('scenario page with no ai configured', { tag: ['@read', '@scenario'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        tmpProjects = projectsCopy()

        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects, AI_PROVIDER: '' })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
    })

    test('disables the suggestions button instead of hiding it, and says why on hover', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('cenario-sugestoes')).toBeVisible()
        await expect(page.getByTestId('cenario-sugestoes')).toBeDisabled()

        await page.mouse.move(640, 500)
        await expect(async () => {
            await page.getByTestId('cenario-sugestoes').hover({ force: true })
            await expect(page.getByText('Configure um provedor de IA para usar isto').first()).toBeVisible({ timeout: 1000 })
        }).toPass({ timeout: 10_000 })
    })

    test('disables the fix button of a failed run for the same reason', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('cenario-tab-execucoes').click()
        await page.getByTestId('cenario-execucao').nth(1).click()

        await expect(page.getByTestId('execucao-status')).toContainText('Falha')
        await expect(page.getByTestId('execucao-corrigir')).toBeVisible()
        await expect(page.getByTestId('execucao-corrigir')).toBeDisabled()
    })
})

test.describe('scenario management', { tag: ['@write', '@scenario'] }, () => {
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        tmpProjects = projectsCopy()

        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    /** Cada teste mexe ou apaga cenários, então a pasta é resetada antes de cada um. */
    test.beforeEach(() => {
        projectReset(tmpProjects, 'alpha-store')
        projectReset(tmpProjects, 'beta-blog')
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

    /** O cenário sem .feature guarda o título no describe do spec: editá-lo tem de sobreviver ao reload. */
    test('saves the title of a scenario that has no gherkin at all', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/cadastro-de-produto')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('cenario-editar').click()
        await page.getByTestId('contexto-titulo').fill('Cadastro de produto revisado')
        await page.getByTestId('cenario-editar-salvar').click()

        await expect(page.getByTestId('cenario-titulo')).toHaveText('Cadastro de produto revisado')

        await page.reload()
        await page.locator('[data-hydrated="true"]').waitFor()

        await expect(page.getByTestId('cenario-titulo')).toHaveText('Cadastro de produto revisado')
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

    test('suggests test ids for the events without one', { tag: '@ia' }, async ({ page, request }) => {
        await test.step('point the backend at the configured ollama', async () => {
            await request.put(`${BACKEND_URL}/api/settings/ai`, {
                data: { provider: 'ollama', url: process.env.OLLAMA_URL, model: process.env.OLLAMA_MODEL }
            })
        })

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
        await expect(steps).toHaveCount(3)
        await expect(steps.nth(2).getByTestId('execucao-step-titulo')).toHaveText('Ver o painel')
        await expect(steps.nth(2)).toHaveAttribute('data-status', 'waiting')
        await expect(steps.nth(0).getByTestId('execucao-step-titulo')).toHaveText('Abrir página de login')
        await expect(steps.nth(0).locator('[class*="text-success"]')).toBeVisible()
        await expect(steps.nth(1).getByTestId('execucao-step-titulo')).toHaveText('Entrar com usuário/código')
        await expect(steps.nth(1).locator('[class*="text-error"]').first()).toBeVisible()
        await expect(steps.nth(1).getByTestId('execucao-step-erro')).toContainText('Timed out waiting for element')

        await expect(page.getByTestId('execucao-status')).toContainText('Falha')
        await expect(page.getByRole('dialog')).toContainText('Login do cliente')
        await expect(page.getByRole('dialog')).toContainText('Alpha Store')

        await expect(page.getByTestId('execucao-fechar')).toBeVisible()

        const dialogBox = (await page.getByRole('dialog').boundingBox())!
        const statusBox = (await page.getByTestId('execucao-status').boundingBox())!
        expect(statusBox.y, 'o cabeçalho não pode vazar para fora do modal').toBeGreaterThan(dialogBox.y + 8)
        await expect(page.getByTestId('execucao-detalhes')).toContainText('Login do cliente')
        const video = page.getByTestId('execucao-video')
        await expect(video).toHaveAttribute('src', /runner\/video\?path=/)
        await expect(video).toHaveAttribute('preload', 'metadata')
        const videoWidth = (await video.boundingBox())!.width
        const containerWidth = (await video.locator('xpath=..').boundingBox())!.width
        expect(videoWidth).toBeLessThan(containerWidth * 0.8)

        expect(requestedUrl).toContain('spec=tests%2Flogin-do-cliente.spec.ts')
    })

    test('proposes an ai fix for the failing step and applies it', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.route('**/api/projects/alpha-store/run-stream*', async (route) => {
            const events = [
                { event: 'run:started', total: 1, steps: ['Entrar com usuário/código'] },
                { event: 'test', id: 't1', title: 'login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'failed', durationMs: 50, error: "locator('#v-0') resolved to hidden" },
                { event: 'test', id: 't1', title: 'login', status: 'failed', durationMs: 60, error: 'falhou', videoPath: null },
                { event: 'run:finished', status: 'failed', passed: false },
            ]
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
            })
        })

        let fixRequest: { step?: string, error?: string } | null = null
        await page.route('**/api/projects/alpha-store/scenario-fix', async (route) => {
            fixRequest = route.request().postDataJSON()
            await new Promise((resolve) => setTimeout(resolve, 700))
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    playwright: "await page.getByTestId('login-usuario').fill('482910')",
                    summary: 'Troquei o id gerado #v-0 pelo data-testid login-usuario.',
                }),
            })
        })

        let patched: { playwright?: string } | null = null
        await page.route('**/api/projects/alpha-store/scenarios/login-do-cliente', async (route) => {
            if (route.request().method() !== 'PATCH') return route.fallback()

            patched = route.request().postDataJSON()
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
        })

        await page.getByTestId('cenario-testar').click()
        await expect(page.getByTestId('execucao-status')).toContainText('Falha')

        await test.step('ask for the fix and see the proposal', async () => {
            await page.getByTestId('execucao-corrigir').click()

            await expect(page.getByTestId('correcao-carregando')).toBeVisible()
            await expect(page.getByTestId('execucao-status'), 'o resultado sai da tela enquanto a correção carrega').toBeHidden()

            await expect(page.getByTestId('correcao-resumo')).toContainText('login-usuario')
            await expect(page.getByTestId('correcao-spec')).toHaveValue(/getByTestId\('login-usuario'\)/)
        })

        expect(fixRequest!.step).toBe('Entrar com usuário/código')
        expect(fixRequest!.error).toContain("locator('#v-0')")

        await test.step('apply the proposal', async () => {
            await page.getByTestId('correcao-aplicar').click()

            await expect(page.getByTestId('correcao-proposta')).toBeHidden()
        })

        expect(patched!.playwright).toBe("await page.getByTestId('login-usuario').fill('482910')")
    })

    test('reports failure when the test dies with a step still running', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.route('**/api/projects/alpha-store/run-stream*', async (route) => {
            const events = [
                { event: 'run:started', total: 1, steps: ['Abrir página de login', 'Entrar com usuário/código'] },
                { event: 'test', id: 't1', title: 'login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir página de login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir página de login', status: 'success', durationMs: 100 },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'failed', durationMs: 0, error: 'Test timeout of 30000ms exceeded.' },
                { event: 'test', id: 't1', title: 'login', status: 'failed', durationMs: 31982, error: 'Test timeout of 30000ms exceeded.', videoPath: null },
                { event: 'run:finished', status: 'failed', passed: false },
            ]
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
            })
        })

        await page.getByTestId('cenario-testar').click()

        await expect(page.getByTestId('execucao-status')).toContainText('Falha')
        await expect(page.getByTestId('execucao-step').nth(1).getByTestId('execucao-step-erro')).toContainText('Test timeout of 30000ms exceeded.')
        await expect(page.getByTestId('execucao-corrigir')).toBeVisible()
    })

    test('turns a green step red when the timeout correction arrives for it', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.route('**/api/projects/alpha-store/run-stream*', async (route) => {
            const events = [
                { event: 'run:started', total: 1, steps: ['Abrir página de login', 'Entrar com usuário/código'] },
                { event: 'test', id: 't1', title: 'login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir página de login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir página de login', status: 'success', durationMs: 100 },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'success', durationMs: 6055 },
                { event: 'step', testId: 't1', title: 'Entrar com usuário/código', status: 'failed', durationMs: 0, error: 'Test timeout of 10000ms exceeded.' },
                { event: 'test', id: 't1', title: 'login', status: 'failed', durationMs: 10100, error: 'Test timeout of 10000ms exceeded.', videoPath: null },
                { event: 'run:finished', status: 'failed', passed: false },
            ]
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
            })
        })

        await page.getByTestId('cenario-testar').click()

        await expect(page.getByTestId('execucao-status')).toContainText('Falha')

        const steps = page.getByTestId('execucao-step')
        await expect(steps, 'a correção corrige a linha, não empilha outra').toHaveCount(2)
        await expect(steps.nth(1)).toHaveAttribute('data-status', 'failed')
        await expect(steps.nth(1).getByTestId('execucao-step-erro')).toContainText('Test timeout of 10000ms exceeded.')
        await expect(page.getByTestId('execucao-corrigir')).toBeVisible()
    })

    test('reports failure even when no step was marked as failed', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/login-do-cliente')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.route('**/api/projects/alpha-store/run-stream*', async (route) => {
            const events = [
                { event: 'run:started', total: 1, steps: ['Abrir página de login'] },
                { event: 'test', id: 't1', title: 'login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir página de login', status: 'pending' },
                { event: 'step', testId: 't1', title: 'Abrir página de login', status: 'success', durationMs: 100 },
                { event: 'test', id: 't1', title: 'login', status: 'failed', durationMs: 200, error: 'beforeEach hook falhou', videoPath: null },
                { event: 'run:finished', status: 'failed', passed: false },
            ]
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(''),
            })
        })

        await page.getByTestId('cenario-testar').click()

        await expect(page.getByTestId('execucao-status')).toContainText('Falha')
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

    test('edits the auth setup through the same modal, minus file, domain and tags', async ({ page }) => {
        await page.goto('/projects/beta-blog/scenarios/auth')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('cenario-editar').click()

        await expect(page.getByTestId('contexto-path'), 'o caminho do auth é fixo').toBeHidden()
        await expect(page.getByTestId('contexto-dominio')).toBeHidden()
        await expect(page.getByTestId('contexto-tags'), 'o auth roda como setup dos outros, não é um cenário marcado').toBeHidden()

        await page.getByTestId('contexto-titulo').fill('Entrar no blog')
        await page.getByTestId('contexto-cenario').fill('Funcionalidade: Entrar no blog')
        await page.getByTestId('cenario-editar-salvar').click()

        await expect(page).toHaveURL('/projects/beta-blog/scenarios/auth')
        await expect(page.getByTestId('cenario-titulo')).toHaveText('Entrar no blog')
        await expect(page.getByTestId('cenario-caminho')).toHaveText('tests/auth.setup.ts')
        expect(existsSync(join(tmpProjects, 'beta-blog', 'features', 'auth.feature'))).toBe(true)
    })

    test('dismisses the login from the auth page itself, without going back to the project', async ({ page }) => {
        await page.goto('/projects/alpha-store/scenarios/auth')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('auth-dispensar').click()

        await test.step('the page says the login was dismissed, in place', async () => {
            await expect(page.getByTestId('cenario-auth-status')).toHaveText('Dispensada', { timeout: 10_000 })
        })

        await test.step('the project page stops asking for a login', async () => {
            await page.goto('/projects/alpha-store')
            await page.locator('[data-hydrated="true"]').waitFor()

            await expect(page.getByTestId('projeto-auth-aviso')).toBeHidden()
        })
    })
})
