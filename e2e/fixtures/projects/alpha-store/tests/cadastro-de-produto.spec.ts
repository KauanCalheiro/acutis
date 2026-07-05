import { test, expect } from '@playwright/test'

test.describe('Cadastro de produto', { tag: ['@write', '@admin'] }, () => {
    test('cria um produto', async ({ page }) => {
        await page.goto('/')
    })
})
