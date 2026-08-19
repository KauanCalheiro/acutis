import { test, expect, type Page } from '@playwright/test'
import { rmSync } from 'node:fs'
import { isolatedProjects, startBackend } from '../support/backend'

function primaryColor(page: Page) {
    return page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--ui-color-primary-500').trim(),
    )
}

test.describe('theme primary color', { tag: ['@write', '@theme'] }, () => {
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

    test.beforeEach(async ({ page }) => {
        await test.step('open the projects page and wait for hydration', async () => {
            await page.goto('/')
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

    test('keeps the picker open when the mouse leaves the navbar', async ({ page }) => {
        await page.getByTestId('navbar-cor').click()
        await page.getByTestId('cor-green').waitFor()

        await page.mouse.move(640, 400)

        await expect(page.getByTestId('cor-green')).toBeVisible()
    })

    test('the favicon follows the primary color', async ({ page }) => {
        const favicon = () => page.locator('link[rel="icon"]').getAttribute('href')

        await expect.poll(favicon).toContain('data:image/svg+xml')
        const before = await favicon()

        await page.getByTestId('navbar-cor').click()
        await page.getByTestId('cor-green').click()

        await expect.poll(favicon).not.toBe(before)
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
