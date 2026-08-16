import { test, expect, type Page } from '@playwright/test'
import { rmSync } from 'node:fs'
import { isolatedProjects, startBackend } from '../support/backend'

/** Escolhe o modelo digitando o nome e clicando na primeira opção filtrada. */
async function escolherModelo(page: Page, nome: string) {
    await page.getByTestId('config-ia-modelo').click()
    await page.keyboard.type(nome)
    await page.getByRole('option').first().click()
}

test.describe('ai settings', { tag: ['@write', '@settings'] }, () => {
    let stopBackend: () => Promise<void>
    let projects: string

    test.beforeAll(async () => {
        projects = isolatedProjects()
        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: projects })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(projects, { recursive: true, force: true })
    })

    test('opens from the navbar without taking the user off the page', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()

        await expect(page.getByTestId('config-ia-provedor')).toBeVisible()
        await expect(page).toHaveURL('/')
    })

    test('lists only the providers the backend can call, named and with their logo', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()

        await expect(page.getByRole('option')).toHaveText([
            'Sem IA',
            'Anthropic',
            'Claude Agent',
            'Google Gemini',
            'Ollama',
            'OpenAI',
            'OpenRouter'
        ])

        await expect(page.getByRole('option', { name: 'OpenAI', exact: true }).locator('[class*="i-simple-icons:openai"]')).toBeVisible()
    })

    test('saves the provider with its key, masked until asked to reveal it', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('pick a provider and paste its key', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'OpenAI', exact: true }).click()
            await page.getByTestId('config-ia-chave').fill('sk-secreta-do-teste')
            await escolherModelo(page, 'gpt-4o')
            await page.getByTestId('config-ia-salvar').click()
        })

        await test.step('the modal closes and the toast reports the save', async () => {
            await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()
            await expect(page.getByTestId('config-ia-provedor')).toBeHidden()
        })

        await test.step('reopening brings the key back, masked', async () => {
            await page.getByTestId('navbar-configuracoes').click()

            await expect(page.getByTestId('config-ia-chave')).toHaveValue('sk-secreta-do-teste')
            await expect(page.getByTestId('config-ia-chave')).toHaveAttribute('type', 'password')
        })

        await test.step('revealing shows it, and hiding masks it again', async () => {
            await page.getByTestId('config-ia-chave-revelar').click()
            await expect(page.getByTestId('config-ia-chave')).toHaveAttribute('type', 'text')

            await page.getByTestId('config-ia-chave-revelar').click()
            await expect(page.getByTestId('config-ia-chave')).toHaveAttribute('type', 'password')
        })
    })

    test('keeps a credential per provider, so switching back does not ask for the key again', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('configure a second provider', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'Anthropic', exact: true }).click()
            await page.getByTestId('config-ia-chave').fill('sk-da-anthropic')
            await escolherModelo(page, 'claude-sonnet-4-5')
            await page.getByTestId('config-ia-salvar').click()
            await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()
        })

        await test.step('going back to the first one brings its own key', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'OpenAI', exact: true }).click()

            await expect(page.getByTestId('config-ia-chave')).toHaveValue('sk-secreta-do-teste')
        })
    })

    test('saves a local provider with its address and model, and no key at all', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('point the local provider at another machine', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'Ollama', exact: true }).click()
            await page.getByTestId('config-ia-url').fill('http://192.168.0.124:11434')
            await escolherModelo(page, 'qwen3-coder:30b')
            await page.getByTestId('config-ia-salvar').click()
        })

        await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()

        await test.step('reopening brings the address and the model back', async () => {
            await page.getByTestId('navbar-configuracoes').click()

            await expect(page.getByTestId('config-ia-url')).toHaveValue('http://192.168.0.124:11434')
            await expect(page.getByTestId('config-ia-modelo')).toContainText('qwen3-coder:30b')
        })
    })

    test('asks for the model of the provider being configured', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()
        await page.getByRole('option', { name: 'OpenRouter', exact: true }).click()
        await page.getByTestId('config-ia-chave').fill('sk-do-openrouter')
        await page.getByTestId('config-ia-salvar').click()

        await expect(page.getByText('Escolha um modelo do provedor.')).toBeVisible()
    })

    test('shows the default address of the provider on the empty field', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()
        await page.getByRole('option', { name: 'Anthropic', exact: true }).click()

        await expect(page.getByTestId('config-ia-url')).toHaveValue('')
        await expect(page.getByTestId('config-ia-url')).toHaveAttribute('placeholder', 'https://api.anthropic.com/v1')
    })

    test('keeps announcing the default address of a provider pointed somewhere else', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('point a configured provider at an internal address', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'Anthropic', exact: true }).click()
            await page.getByTestId('config-ia-url').fill('http://interno.acme:9000')
            await page.getByTestId('config-ia-salvar').click()
            await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()
        })

        await test.step('reopening keeps the saved address, and the placeholder still announces the default', async () => {
            await page.getByTestId('navbar-configuracoes').click()

            await expect(page.getByTestId('config-ia-url')).toHaveValue('http://interno.acme:9000')
            await expect(page.getByTestId('config-ia-url')).toHaveAttribute('placeholder', 'https://api.anthropic.com/v1')
        })
    })

    test('asks for the key of the provider being switched to', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()
        await page.getByRole('option', { name: 'Google Gemini', exact: true }).click()
        await escolherModelo(page, 'gemini-2.5-flash')
        await page.getByTestId('config-ia-salvar').click()

        await expect(page.getByText('A chave de API do provedor escolhido é obrigatória.')).toBeVisible()
    })

    /**
     * O Claude Agent roda o binário local já autenticado: o formulário dele não pede credencial
     * nenhuma, só explica o que instalar. O nome na tela nunca é "Claude Code" — diretriz de marca
     * da Anthropic para produto de terceiro.
     */
    test('offers the local agent with no credential to fill in, only what to install', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('pick the local agent, named as the branding guidelines allow', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()

            await expect(page.getByRole('option', { name: 'Claude Code', exact: true })).toHaveCount(0)
            await page.getByRole('option', { name: 'Claude Agent', exact: true }).click()
        })

        await test.step('there is no key, no address and no token to fill in', async () => {
            await expect(page.getByTestId('config-ia-chave')).toBeHidden()
            await expect(page.getByTestId('config-ia-url')).toBeHidden()
            await expect(page.getByTestId('config-ia-token')).toHaveCount(0)
        })

        await test.step('the setup steps are on screen, with a link to the docs', async () => {
            await expect(page.getByTestId('config-ia-claude-agent')).toContainText('claude login')
            await expect(page.getByTestId('config-ia-claude-agent-documentacao')).toHaveAttribute(
                'href',
                'https://docs.claude.com/en/docs/claude-code/setup'
            )
        })
    })

    test('saves the local agent with just a model, and lists the models it reaches', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('pick the model offered by the local agent', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'Claude Agent', exact: true }).click()
            await escolherModelo(page, 'claude-sonnet-5')
            await page.getByTestId('config-ia-salvar').click()
        })

        await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()

        await test.step('reopening comes back on the same provider and model', async () => {
            await page.getByTestId('navbar-configuracoes').click()

            await expect(page.getByTestId('config-ia-modelo')).toContainText('claude-sonnet-5')
        })
    })

    /** Deixa a IA desligada para o resto do describe: mantenha este teste por último. */
    test('turns the ai off from the select, without asking for a key and without losing the saved ones', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('choose no provider at all', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'Sem IA', exact: true }).click()
        })

        await test.step('there is no credential left to fill in', async () => {
            await expect(page.getByTestId('config-ia-desligada')).toBeVisible()
            await expect(page.getByTestId('config-ia-chave')).toBeHidden()
            await expect(page.getByTestId('config-ia-url')).toBeHidden()
        })

        await page.getByTestId('config-ia-salvar').click()
        await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()

        await test.step('reopening comes back on "Sem IA", with the old keys still there', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await expect(page.getByTestId('config-ia-desligada')).toBeVisible()

            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'OpenAI', exact: true }).click()
            await expect(page.getByTestId('config-ia-chave')).toHaveValue('sk-secreta-do-teste')
        })
    })
})
