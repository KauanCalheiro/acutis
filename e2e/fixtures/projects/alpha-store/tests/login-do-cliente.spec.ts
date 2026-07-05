import { test, expect } from '@playwright/test'

test.describe('Login do cliente', { tag: ['@read', '@login'] }, () => {
    test('entra com credenciais válidas', async ({ page }) => {
        await page.goto('/')
    })
})
