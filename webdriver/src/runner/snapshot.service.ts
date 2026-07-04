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

            const elements = await page.$$eval(
                'input, button, a, select, textarea, [role="button"]',
                (nodes) => nodes.slice(0, 100).map((node) => {
                    const el = node as HTMLElement
                    const attr = (name: string) => el.getAttribute(name)

                    return {
                        tag: el.tagName.toLowerCase(),
                        type: attr('type'),
                        id: el.id || null,
                        name: attr('name'),
                        testId: attr('data-testid') ?? attr('data-test') ?? attr('data-cy'),
                        placeholder: attr('placeholder'),
                        ariaLabel: attr('aria-label'),
                        text: (el.textContent ?? '').trim().slice(0, 80) || null,
                    }
                }),
            )

            return { url: page.url(), title: await page.title(), elements }
        } finally {
            await browser.close()
        }
    }
}
