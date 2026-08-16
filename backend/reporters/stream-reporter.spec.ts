import { afterAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import StreamReporter from './stream-reporter.cjs'

const MARKER = '@@ACUTIS_RUN@@'

interface Emitted {
    event: string
    title?: string
    status?: string
    error?: string | null
    durationMs?: number
    steps?: string[]
    file?: string
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

    it('reopens the last finished step when the timeout hit it without marking it', () => {
        const emitted = record((reporter) => {
            reporter.onTestBegin(test)
            reporter.onStepBegin(test, null, step('Abrir a home'))
            reporter.onStepEnd(test, null, step('Abrir a home'))
            reporter.onStepBegin(test, null, step('Clicar em Entrar'))
            reporter.onStepEnd(test, null, step('Clicar em Entrar'))
            reporter.onTestEnd(test, timedOut())
        })

        const steps = emitted.filter(event => event.event === 'step')

        expect(steps.at(-1)).toMatchObject({
            title: 'Clicar em Entrar',
            status: 'failed',
            error: 'Test timeout of 30000ms exceeded.',
        })
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

describe('passos declarados de cada teste', () => {
    const dir = mkdtempSync(join(tmpdir(), 'acutis-reporter-'))

    function specFile(name: string, steps: string[]) {
        const file = join(dir, name)
        writeFileSync(file, steps.map(title => `await test.step('${title}', async () => {})`).join('\n'))

        return file
    }

    function suiteOf(tests: unknown[]) {
        return { allTests: () => tests }
    }

    afterAll(() => {
        rmSync(dir, { recursive: true, force: true })
    })

    it('anuncia os passos do arquivo do teste assim que ele começa', () => {
        const file = specFile('login.spec.ts', ['Abrir a home', 'Entrar'])
        const test = { id: 't1', title: 'Login do cliente', location: { file } }

        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([test]))
            reporter.onTestBegin(test)
        })

        const begin = emitted.find(event => event.event === 'test' && event.status === 'pending')

        expect(begin!.steps).toEqual(['Abrir a home', 'Entrar'])
    })

    it('diz de qual arquivo o teste veio, que é o cenário dono da execução', () => {
        const file = specFile('quem-sou.spec.ts', ['Abrir a home'])
        const test = { id: 't1', title: 'Login do cliente', location: { file } }

        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([test]))
            reporter.onTestBegin(test)
            reporter.onTestEnd(test, { status: 'passed', duration: 100, errors: [], attachments: [] })
        })

        const reported = emitted.filter(event => event.event === 'test')

        expect(reported.map(event => event.file)).toEqual([file, file])
    })

    it('dá a cada teste só os passos do arquivo dele', () => {
        const login = { id: 't1', title: 'Login do cliente', location: { file: specFile('um.spec.ts', ['Abrir a home']) } }
        const cadastro = { id: 't2', title: 'Cadastro de produto', location: { file: specFile('dois.spec.ts', ['Salvar o produto']) } }

        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([login, cadastro]))
            reporter.onTestBegin(login)
            reporter.onTestBegin(cadastro)
        })

        const begins = emitted.filter(event => event.event === 'test' && event.status === 'pending')

        expect(begins.map(event => event.steps)).toEqual([['Abrir a home'], ['Salvar o produto']])
    })

    it('mostra o login inteiro quando o run tem vários cenários, porque ali ele é um item da lista', () => {
        const auth = { id: 'auth', title: 'Autenticação', location: { file: specFile('auth.setup.ts', ['Preencher credenciais', 'Entrar']) } }
        const um = { id: 's1', title: 'Ver disciplina', location: { file: specFile('ver-disciplina.spec.ts', ['Abrir a disciplina']) } }
        const dois = { id: 's2', title: 'Ver nota', location: { file: specFile('ver-nota.spec.ts', ['Abrir a nota']) } }

        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([auth, um, dois]))
            reporter.onTestBegin(auth)
            reporter.onStepBegin(auth, null, { category: 'test.step', title: 'Preencher credenciais', duration: 1 })
        })

        const begin = emitted.find(event => event.event === 'test' && event.status === 'pending')
        const steps = emitted.filter(event => event.event === 'step')

        expect(begin!.steps).toEqual(['Preencher credenciais', 'Entrar'])
        expect(steps.map(event => event.title)).toEqual(['Preencher credenciais'])
    })

    it('anuncia o login colapsado como passo único quando ele é só a dependência', () => {
        const auth = { id: 'auth', title: 'Autenticação', location: { file: specFile('auth.setup.ts', ['Preencher credenciais', 'Entrar']) } }
        const scenario = { id: 's1', title: 'Ver disciplina', location: { file: specFile('ver.spec.ts', ['Abrir a disciplina']) } }

        const emitted = record((reporter) => {
            reporter.onBegin(null, suiteOf([auth, scenario]))
            reporter.onTestBegin(auth)
        })

        const begin = emitted.find(event => event.event === 'test' && event.status === 'pending')

        expect(begin!.steps).toEqual(['Autenticação'])
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
