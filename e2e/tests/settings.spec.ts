import { test, expect, type Page } from '@playwright/test'
import { rmSync } from 'node:fs'
import { isolatedProjects, startBackend } from '../support/backend'

/**
 * Escolhe o modelo digitando o nome.
 *
 * Clica na primeira opção filtrada, e não na de criar: quando existe um provedor de verdade
 * respondendo (o Ollama da máquina de quem roda a suíte), o nome digitado casa com um item da lista
 * e a opção de criar nem aparece. Sem provedor alcançável, a de criar é a única — e é ela que
 * garante que provedor fora do ar não impede o cadastro.
 */
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

    test('saves the provider with its key, masked until asked to reveal it', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('pick a provider and paste its key', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'openai', exact: true }).click()
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
            await page.getByRole('option', { name: 'anthropic', exact: true }).click()
            await page.getByTestId('config-ia-chave').fill('sk-da-anthropic')
            await escolherModelo(page, 'claude-sonnet-4-5')
            await page.getByTestId('config-ia-salvar').click()
            await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()
        })

        await test.step('going back to the first one brings its own key', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'openai', exact: true }).click()

            await expect(page.getByTestId('config-ia-chave')).toHaveValue('sk-secreta-do-teste')
        })
    })

    test('saves a local provider with its address and model, and no key at all', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('point the local provider at another machine', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'ollama', exact: true }).click()
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

    /**
     * Não existe mais modelo padrão do provedor: quem pluga escolhe o modelo, e sem essa escolha o
     * cadastro só falharia na primeira geração, com um 404 do provedor.
     */
    test('asks for the model of the provider being configured', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()
        await page.getByRole('option', { name: 'cohere', exact: true }).click()
        await page.getByTestId('config-ia-chave').fill('sk-da-cohere')
        await page.getByTestId('config-ia-salvar').click()

        await expect(page.getByText('Escolha um modelo do provedor.')).toBeVisible()
    })

    test('shows the default address of the provider on the empty field', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()
        await page.getByRole('option', { name: 'anthropic', exact: true }).click()

        await expect(page.getByTestId('config-ia-url')).toHaveValue('')
        await expect(page.getByTestId('config-ia-url')).toHaveAttribute('placeholder', 'https://api.anthropic.com/v1')
    })

    /**
     * O endereço salvo entra no lugar do padrão dentro do config, e o placeholder não pode segui-lo.
     * O provedor local não serve de exemplo aqui: o padrão dele sai de OLLAMA_URL, que muda por máquina.
     */
    test('keeps announcing the default address of a provider pointed somewhere else', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('point a configured provider at an internal address', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'anthropic', exact: true }).click()
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
        await page.getByRole('option', { name: 'mistral', exact: true }).click()
        await escolherModelo(page, 'mistral-large-latest')
        await page.getByTestId('config-ia-salvar').click()

        await expect(page.getByText('A chave de API do provedor escolhido é obrigatória.')).toBeVisible()
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
            await page.getByRole('option', { name: 'openai', exact: true }).click()
            await expect(page.getByTestId('config-ia-chave')).toHaveValue('sk-secreta-do-teste')
        })
    })
})
