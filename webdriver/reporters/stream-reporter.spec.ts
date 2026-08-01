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

describe('autenticação como dependência de um cenário', () => {
    const authTest = { id: 'auth', title: 'Autenticação', location: { file: '/proj/tests/auth.setup.ts' } }
    const scenarioTest = { id: 's1', title: 'Ver disciplina', location: { file: '/proj/tests/disciplinas/ver.spec.ts' } }

    function suiteOf(tests: unknown[]) {
        return { allTests: () => tests }
    }

    function passed() {
        return { status: 'passed', duration: 100, errors: [], attachments: [{ name: 'video', path: '/tmp/auth.webm' }] }
    }

    it('anuncia a autenticação como um passo só, antes dos passos do cenário', () => {
        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([authTest, scenarioTest]))
        })

        const started = emitted.find(e => e.event === 'run:started') as unknown as { steps: string[] }

        expect(started.steps[0]).toBe('Autenticação')
        expect(started.steps).toHaveLength(1)
    })

    it('colapsa os passos internos do login num passo só', () => {
        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([authTest, scenarioTest]))
            reporter.onTestBegin(authTest)
            reporter.onStepBegin(authTest, null, step('Preencher credenciais'))
            reporter.onStepEnd(authTest, null, step('Preencher credenciais'))
            reporter.onTestEnd(authTest, passed())
        })

        const steps = emitted.filter(e => e.event === 'step')

        expect(steps.map(s => s.title)).toEqual(['Autenticação', 'Autenticação'])
        expect(steps.map(s => s.status)).toEqual(['pending', 'success'])
    })

    it('não entrega o vídeo do login quando ele é só a dependência', () => {
        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([authTest, scenarioTest]))
            reporter.onTestBegin(authTest)
            reporter.onTestEnd(authTest, passed())
        })

        const finished = emitted.find(e => e.event === 'test' && e.status === 'success') as unknown as { videoPath: string | null }

        expect(finished.videoPath).toBeNull()
    })

    it('mostra o login inteiro, com vídeo, quando ele é o teste que se está rodando', () => {
        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([authTest]))
            reporter.onTestBegin(authTest)
            reporter.onStepBegin(authTest, null, step('Preencher credenciais'))
            reporter.onStepEnd(authTest, null, step('Preencher credenciais'))
            reporter.onTestEnd(authTest, passed())
        })

        const steps = emitted.filter(e => e.event === 'step')
        const finished = emitted.find(e => e.event === 'test' && e.status === 'success') as unknown as { videoPath: string | null }

        expect(steps.map(s => s.title)).toEqual(['Preencher credenciais', 'Preencher credenciais'])
        expect(finished.videoPath).toBe('/tmp/auth.webm')
    })
})

describe('erro global do playwright', () => {
    function recordStderr(run: (reporter: InstanceType<typeof StreamReporter>) => void): string {
        let written = ''
        const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
            written += String(chunk)

            return true
        })

        try {
            run(new StreamReporter())
        } finally {
            spy.mockRestore()
        }

        return written
    }

    it('deixa o erro chegar na saida do processo, senao ninguem fica sabendo', () => {
        // Este reporter e o unico do run; o que ele engolir some para sempre.
        const written = recordStderr((reporter) => {
            reporter.onError({ message: 'Error: No tests found.' })
        })

        expect(written).toContain('No tests found')
    })

    it('limpa os codigos de cor antes de escrever', () => {
        const colorido = `\u001b[31mError: quebrou\u001b[39m`
        const written = recordStderr((reporter) => {
            reporter.onError({ message: colorido })
        })

        expect(written).toContain('Error: quebrou')
        expect(written).not.toContain('[31m')
    })
})
