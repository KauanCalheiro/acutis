import { test, expect } from '@playwright/test'

// Exemplo de teste gerado pelo Acutis
test('exemplo', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/.*/)
})
