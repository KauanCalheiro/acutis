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

    test('saves the provider with its key, and never shows the key again', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await test.step('pick a provider and paste its key', async () => {
            await page.getByTestId('navbar-configuracoes').click()
            await page.getByTestId('config-ia-provedor').click()
            await page.getByRole('option', { name: 'openai', exact: true }).click()
            await page.getByTestId('config-ia-chave').fill('sk-secreta-do-teste')
            await page.getByTestId('config-ia-salvar').click()
        })

        await expect(page.getByText('Configuração salva', { exact: true })).toBeVisible()

        await test.step('reopening shows the key as configured, without giving it back', async () => {
            await expect(page.getByTestId('config-ia-chave-definida')).toBeVisible()
            await expect(page.getByTestId('config-ia-chave')).toHaveValue('')
            expect(await page.content()).not.toContain('sk-secreta-do-teste')
        })
    })

    test('asks for the key of the provider being switched to', async ({ page }) => {
        await page.goto('/')
        await page.locator('[data-hydrated="true"]').waitFor()

        await page.getByTestId('navbar-configuracoes').click()
        await page.getByTestId('config-ia-provedor').click()
        await page.getByRole('option', { name: 'anthropic', exact: true }).click()
        await page.getByTestId('config-ia-salvar').click()

        await expect(page.getByText('A chave de API do provedor escolhido é obrigatória.')).toBeVisible()
    })
})
