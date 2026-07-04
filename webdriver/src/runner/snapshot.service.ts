import { Injectable } from '@nestjs/common'
import { chromium } from 'playwright'

export interface SnapshotElement {
    tag: string
    type: string | null
    id: string | null
    name: string | null
    testId: string | null
    placeholder: string | null
    ariaLabel: string | null
    text: string | null
    visible: boolean
}

export interface Snapshot {
    url: string
    title: string
    elements: SnapshotElement[]
}

@Injectable()
export class SnapshotService {
    async capture(url: string): Promise<Snapshot> {
        const browser = await chromium.launch()

        try {
            const page = await browser.newPage()
            await page.goto(url, { waitUntil: 'domcontentloaded' })
            await page.waitForSelector('input, button, [role="button"]', { timeout: 8000 }).catch(() => { /* página sem formulário */ })

            const elements = await page.$$eval(
                'input, button, a, select, textarea, [role="button"]',
                (nodes) => nodes.slice(0, 100).map((node) => {
                    const el = node as HTMLElement
                    const attr = (name: string) => el.getAttribute(name)

                    const rect = el.getBoundingClientRect()

                    return {
                        tag: el.tagName.toLowerCase(),
                        type: attr('type'),
                        id: el.id || null,
                        name: attr('name'),
                        testId: attr('data-testid') ?? attr('data-test') ?? attr('data-cy'),
                        placeholder: attr('placeholder'),
                        ariaLabel: attr('aria-label'),
                        text: (el.textContent ?? '').trim().slice(0, 80) || null,
                        visible: rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden',
                    }
                }),
            )

            return { url: page.url(), title: await page.title(), elements }
        } finally {
            await browser.close()
        }
    }
}
