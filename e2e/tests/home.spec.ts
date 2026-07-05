import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'

const BACKEND_DIR = resolve(import.meta.dirname, '../../backend')
const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures/projects')
const BACKEND_URL = 'http://localhost:4200'
const FIXTURE_COUNT = 8

let backend: ChildProcess

async function fetchProjectsTotal(): Promise<number | null> {
    try {
        const res = await fetch(`${BACKEND_URL}/api/v1/projects`)
        if (!res.ok) return null
        const body = await res.json()
        return body.meta.total
    } catch {
        return null
    }
}

async function waitForBackend(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        const total = await fetchProjectsTotal()
        if (total === FIXTURE_COUNT) return
        if (total !== null) {
            throw new Error(`backend on ${BACKEND_URL} returned ${total} projects instead of the ${FIXTURE_COUNT} fixtures; stale server on the port?`)
        }
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('backend did not become healthy in time')
}

test.describe('projects home', { tag: ['@read', '@project'] }, () => {
    test.beforeAll(async () => {
        backend = spawn('php', ['artisan', 'serve', '--port=4200'], {
            cwd: BACKEND_DIR,
            stdio: 'ignore',
            env: { ...process.env, ACUTIS_PROJECTS_PATH: FIXTURES_DIR },
        })
        await waitForBackend()
    })

    test.afterAll(() => {
        backend.kill()
    })

    test.beforeEach(async ({ page }) => {
        await test.step('open home and wait for hydration', async () => {
            await page.goto('/')
            await page.locator('[data-hydrated="true"]').waitFor()
        })
    })

    test('lists the first page of projects', async ({ page }) => {
        await expect(page.getByTestId('projeto-card')).toHaveCount(6)
        await expect(page.getByTestId('projeto-card').first()).toContainText('Alpha Store')
    })

    test('search filters projects server-side', async ({ page }) => {
        await test.step('type a unique term in the search input', async () => {
            await page.getByTestId('projeto-busca').fill('zumbi')
        })

        await expect(page.getByTestId('projeto-card')).toHaveCount(1)
        await expect(page.getByTestId('projeto-card')).toContainText('Zumbi Tracker')
    })

    test('pagination navigates to the second page', async ({ page }) => {
        await test.step('go to page 2', async () => {
            await page.getByTestId('projeto-paginacao').getByRole('button', { name: 'Page 2' }).click()
        })

        await expect(page.getByTestId('projeto-card')).toHaveCount(2)
        await expect(page.getByTestId('projeto-card').first()).toContainText('Golf Panel')
    })

    test('search without matches shows the empty state', async ({ page }) => {
        await test.step('type a term that matches nothing', async () => {
            await page.getByTestId('projeto-busca').fill('xyznope')
        })

        await expect(page.getByTestId('projeto-vazio')).toBeVisible()
    })
})
