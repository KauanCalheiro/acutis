import { describe, expect, it, vi } from 'vitest'
import StreamReporter from './stream-reporter.cjs'

const MARKER = '@@ACUTIS_RUN@@'

interface Emitted {
    event: string
    title?: string
    status?: string
    error?: string | null
    durationMs?: number
}

function record(run: (reporter: InstanceType<typeof StreamReporter>) => void): Emitted[] {
    const emitted: Emitted[] = []
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        emitted.push(JSON.parse(String(chunk).slice(MARKER.length)))

        return true
    })

    try {
        run(new StreamReporter())
    } finally {
        write.mockRestore()
    }

    return emitted
}

const test = { id: 't1', title: 'Realizar login com sucesso' }

function step(title: string, error?: { message: string }) {
    return { category: 'test.step', title, duration: 1579, error }
}

function timedOut() {
    return {
        status: 'timedOut',
        duration: 31982,
        errors: [{ message: 'Test timeout of 30000ms exceeded.' }],
        attachments: [],
    }
}

describe('stream reporter', () => {
    it('closes the step still running when the test times out', () => {
        const emitted = record((reporter) => {
            reporter.onTestBegin(test)
            reporter.onStepBegin(test, null, step('Abrir a home'))
            reporter.onStepEnd(test, null, step('Abrir a home'))
            reporter.onStepBegin(test, null, step('Clicar em Entrar'))
            reporter.onTestEnd(test, timedOut())
        })

        const steps = emitted.filter(event => event.event === 'step')

        expect(steps.at(-1)).toMatchObject({
            title: 'Clicar em Entrar',
            status: 'failed',
            error: 'Test timeout of 30000ms exceeded.',
        })
    })

    it('reports the failing step before the test result', () => {
        const emitted = record((reporter) => {
            reporter.onTestBegin(test)
            reporter.onStepBegin(test, null, step('Clicar em Entrar'))
            reporter.onTestEnd(test, timedOut())
        })

        const failedStep = emitted.findIndex(event => event.event === 'step' && event.status === 'failed')
        const failedTest = emitted.findIndex(event => event.event === 'test' && event.status === 'failed')

        expect(failedStep).toBeGreaterThan(-1)
        expect(failedStep).toBeLessThan(failedTest)
    })

    it('does not close a step that already reported its own error', () => {
        const failure = { message: "locator('#v-0') resolved to hidden" }

        const emitted = record((reporter) => {
            reporter.onTestBegin(test)
            reporter.onStepBegin(test, null, step('Preencher o usuário'))
            reporter.onStepEnd(test, null, step('Preencher o usuário', failure))
            reporter.onTestEnd(test, {
                status: 'failed',
                duration: 5000,
                errors: [failure],
                attachments: [],
            })
        })

        const steps = emitted.filter(event => event.event === 'step')

        expect(steps.filter(event => event.status !== 'pending')).toHaveLength(1)
        expect(steps.at(-1)!.error).toBe("locator('#v-0') resolved to hidden")
    })

    it('keeps a passing test free of failed steps', () => {
        const emitted = record((reporter) => {
            reporter.onTestBegin(test)
            reporter.onStepBegin(test, null, step('Abrir a home'))
            reporter.onStepEnd(test, null, step('Abrir a home'))
            reporter.onTestEnd(test, {
                status: 'passed',
                duration: 1600,
                errors: [],
                attachments: [],
            })
        })

        expect(emitted.filter(event => event.status === 'failed')).toHaveLength(0)
    })
})
