import { test, expect, type Page } from '@playwright/test'

function primaryColor(page: Page) {
    return page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--ui-color-primary-500').trim(),
    )
}

test.describe('theme primary color', { tag: ['@write', '@theme'] }, () => {
    test.beforeEach(async ({ page }) => {
        await test.step('open record page and wait for hydration', async () => {
            await page.goto('/record')
            await page.locator('[data-hydrated="true"]').waitFor()
        })
    })

    test('opens the color picker from the navbar', async ({ page }) => {
        await page.getByTestId('navbar-cor').click()
        await expect(page.getByTestId('cor-green')).toBeVisible()
        await expect(page.getByTestId('cor-rose')).toBeVisible()
    })

    test('every swatch renders with a visible color', async ({ page }) => {
        await page.getByTestId('navbar-cor').click()
        await page.getByTestId('cor-green').waitFor()

        const transparent = await page.evaluate(() =>
            [...document.querySelectorAll('[data-testid^="cor-"]')]
                .filter(el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)')
                .map(el => el.getAttribute('data-testid')),
        )

        expect(transparent).toEqual([])
    })

    test('picking a color changes the primary color', async ({ page }) => {
        const before = await primaryColor(page)

        await page.getByTestId('navbar-cor').click()
        await page.getByTestId('cor-green').click()

        await expect.poll(() => primaryColor(page)).not.toBe(before)
    })

    test('keeps the navbar expanded while the picker is open', async ({ page }) => {
        await test.step('open the picker from the hovered navbar', async () => {
            await page.getByTestId('navbar-cor').click()
            await page.getByTestId('cor-green').waitFor()
        })

        await test.step('move the mouse away from the navbar', async () => {
            await page.mouse.move(640, 400)
        })

        await expect(page.getByTestId('navbar-projetos')).toContainText('Projetos')
        await expect(page.getByTestId('cor-green')).toBeVisible()
    })

    test('keeps the chosen color after reload', async ({ page }) => {
        const before = await primaryColor(page)

        await page.getByTestId('navbar-cor').click()
        await page.getByTestId('cor-violet').click()
        await expect.poll(() => primaryColor(page)).not.toBe(before)
        const chosen = await primaryColor(page)

        await page.reload()
        await page.locator('[data-hydrated="true"]').waitFor()

        expect(await primaryColor(page)).toBe(chosen)
    })
})
