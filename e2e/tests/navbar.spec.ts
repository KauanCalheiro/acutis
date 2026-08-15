import { test, expect } from '@playwright/test'

test.describe('app navbar', { tag: ['@read', '@navbar'] }, () => {
    test.beforeEach(async ({ page }) => {
        await test.step('open the projects page and wait for hydration', async () => {
            await page.goto('/')
            await page.locator('[data-hydrated="true"]').waitFor()
        })
    })

    test('shows the app logo on top and nav items', async ({ page }) => {
        await expect(page.getByTestId('navbar-logo')).toBeVisible()
        await expect(page.getByTestId('navbar-projetos')).toBeVisible()
    })

    test('links point to the app routes', async ({ page }) => {
        await expect(page.getByTestId('navbar-projetos')).toHaveAttribute('href', '/')
    })

    test('stays put while the page scrolls', async ({ page }) => {
        // Janela baixa para a página ter rolagem.
        await page.setViewportSize({ width: 1280, height: 300 })

        const before = await page.locator('aside').boundingBox()

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

        expect((await page.locator('aside').boundingBox())!.y).toBe(before!.y)
    })

    test('is only as tall as what it holds, and never the whole screen', async ({ page }) => {
        const navbar = await page.locator('aside').boundingBox()
        const viewport = page.viewportSize()!

        expect(navbar!.height).toBeLessThan(viewport.height / 2)
    })

    test('names every item, since none of them shows a label', async ({ page }) => {
        await expect(page.getByTestId('navbar-logo')).toHaveAccessibleName('Acutis')
        await expect(page.getByTestId('navbar-projetos')).toHaveAccessibleName('Projetos')
        await expect(page.getByTestId('navbar-configuracoes')).toHaveAccessibleName('Configurações')
        await expect(page.getByTestId('navbar-cor')).toHaveAccessibleName('Cor primária')
        await expect(page.getByTestId('navbar-tema')).not.toHaveAccessibleName('')
    })
})
