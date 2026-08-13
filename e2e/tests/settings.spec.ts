import { test, expect } from '@playwright/test'
import { rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { databaseCopy, startBackend } from '../support/backend'

test.describe('ai settings', { tag: ['@write', '@settings'] }, () => {
    let stopBackend: () => Promise<void>
    let database: string

    test.beforeAll(async () => {
        database = databaseCopy()
        stopBackend = await startBackend({ DB_DATABASE: database })
    })

    test.afterAll(async () => {
        await stopBackend()
        rmSync(dirname(database), { recursive: true, force: true })
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

    test('saves a local provider with its address and models, and no key at all', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('point the local provider at another machine', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'ollama', exact: true }).click()
            await page.getByTestId('config-ia-url').fill('http://192.168.0.124:11434')
            await page.getByTestId('config-ia-modelo-alto').fill('qwen3-coder:30b')
            await page.getByTestId('config-ia-modelo-baixo').fill('gemma4:31b')
            await page.getByTestId('config-ia-salvar').click()
        })

        await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()

        await test.step('reopening brings the address and the models back', async () => {
            await page.getByTestId('navbar-configuracoes').click()

            await expect(page.getByTestId('config-ia-url')).toHaveValue('http://192.168.0.124:11434')
            await expect(page.getByTestId('config-ia-modelo-alto')).toHaveValue('qwen3-coder:30b')
            await expect(page.getByTestId('config-ia-modelo-baixo')).toHaveValue('gemma4:31b')
        })
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

    /** O endereço salvo entra no lugar do padrão dentro do config, e o placeholder não pode segui-lo. */
    test('keeps announcing the default address of a provider pointed somewhere else', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()
        await page.getByRole('option', { name: 'ollama', exact: true }).click()

        await expect(page.getByTestId('config-ia-url')).toHaveValue('http://192.168.0.124:11434')
        await expect(page.getByTestId('config-ia-url')).toHaveAttribute('placeholder', 'http://localhost:11434')
    })

    test('asks for the key of the provider being switched to', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()
        await page.getByRole('option', { name: 'mistral', exact: true }).click()
        await page.getByTestId('config-ia-salvar').click()

        await expect(page.getByText('A chave de API do provedor escolhido é obrigatória.')).toBeVisible()
    })
})
