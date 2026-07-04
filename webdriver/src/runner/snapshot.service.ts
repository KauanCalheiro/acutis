import { Injectable } from '@nestjs/common'
import { chromium } from 'playwright'

export interface SnapshotElement {
    tag: string
    type: string | null
    id: string | null
    name: string | null
    testId: string | null
    selector: string
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
                    const dataTestId = attr('data-testid')
                    const dataTest = attr('data-test')
                    const dataCy = attr('data-cy')
                    const name = attr('name')

                    let selector: string
                    if (dataTestId) selector = `[data-testid="${dataTestId}"]`
                    else if (dataTest) selector = `[data-test="${dataTest}"]`
                    else if (dataCy) selector = `[data-cy="${dataCy}"]`
                    else if (el.id) selector = `#${el.id}`
                    else if (name) selector = `${el.tagName.toLowerCase()}[name="${name}"]`
                    else selector = el.tagName.toLowerCase()

                    return {
                        tag: el.tagName.toLowerCase(),
                        type: attr('type'),
                        id: el.id || null,
                        name,
                        testId: dataTestId ?? dataTest ?? dataCy,
                        selector,
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
