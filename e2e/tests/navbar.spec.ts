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

    test('starts collapsed, without labels', async ({ page }) => {
        await expect(page.getByTestId('navbar-projetos')).not.toContainText('Projetos')
    })

    test('expands with labels and collapses back on toggle', async ({ page }) => {
        await page.getByTestId('navbar-alternar').click()
        await expect(page.getByTestId('navbar-projetos')).toContainText('Projetos')

        await page.getByTestId('navbar-alternar').click()
        await page.mouse.move(640, 400)
        await expect(page.getByTestId('navbar-projetos')).not.toContainText('Projetos')
    })

    test('expands on hover and collapses when the mouse leaves', async ({ page }) => {
        await page.getByTestId('navbar-logo').hover()
        await expect(page.getByTestId('navbar-projetos')).toContainText('Projetos')

        await page.mouse.move(640, 400)
        await expect(page.getByTestId('navbar-projetos')).not.toContainText('Projetos')
    })

    test('does not expand when hovering the bottom controls', async ({ page }) => {
        await page.getByTestId('navbar-cor').hover()

        await expect(page.getByTestId('navbar-projetos')).not.toContainText('Projetos')
    })

    test('expands when hovering the empty middle area', async ({ page }) => {
        const logo = await page.getByTestId('navbar-logo').boundingBox()
        const colorButton = await page.getByTestId('navbar-cor').boundingBox()

        await page.mouse.move(
            logo!.x + logo!.width / 2,
            (logo!.y + logo!.height + colorButton!.y) / 2,
        )

        await expect(page.getByTestId('navbar-projetos')).toContainText('Projetos')
    })

    test('stays expanded after the mouse leaves when pinned', async ({ page }) => {
        await page.getByTestId('navbar-alternar').click()
        await page.mouse.move(640, 400)
        await expect(page.getByTestId('navbar-projetos')).toContainText('Projetos')
    })

    test('keeps the expanded state after reload', async ({ page }) => {
        await page.getByTestId('navbar-alternar').click()
        await expect(page.getByTestId('navbar-projetos')).toContainText('Projetos')

        await page.reload()
        await page.locator('[data-hydrated="true"]').waitFor()
        await expect(page.getByTestId('navbar-projetos')).toContainText('Projetos')
    })

    test('links point to the app routes', async ({ page }) => {
        await expect(page.getByTestId('navbar-projetos')).toHaveAttribute('href', '/')
    })
})
