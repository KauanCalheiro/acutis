// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { RunScenario } from '../run-scenario.js'
import type { RunEvent } from '../../../common/types/run.js'
import type { DomainEventBus } from '../../../common/events/domain-event-bus.js'
import type { ProjectService } from '../../../modules/project/project.service.js'
import type { ScenarioRunner, ScenarioRunOptions } from '../../../modules/scenario/ports/scenario-runner.js'

function projects(): ProjectService {
  return {
    pathOf: () => '/tmp/minha-loja',
    resolvedEnvironment: () => ({ URL: 'https://loja.test' })
  } as unknown as ProjectService
}

/** Guarda as opções que chegaram ao runner, que é por onde o cancelamento viaja. */
function runner(onOptions?: (options: ScenarioRunOptions) => void): ScenarioRunner {
  return {
    runProject: async () => ({ passed: true, output: 'ok' }),
    streamProject: async (_path: string, options: ScenarioRunOptions) => {
      onOptions?.(options)

      return { passed: false, output: 'interrompido' }
    }
  } as unknown as ScenarioRunner
}

describe('RunScenario: execução interrompida', () => {
  it('não guarda a rodada no histórico quando o usuário cancelou', async () => {
    const publish = vi.fn()
    const control = new AbortController()
    const useCase = new RunScenario(projects(), runner(() => control.abort()), { publish } as unknown as DomainEventBus)

    await useCase.stream('minha-loja', { grep: '@smoke' }, () => {}, control.signal)

    expect(publish).not.toHaveBeenCalled()
  })

  it('guarda a rodada que chegou ao fim sozinha', async () => {
    const publish = vi.fn()
    const useCase = new RunScenario(projects(), runner(), { publish } as unknown as DomainEventBus)

    await useCase.stream('minha-loja', { grep: '@smoke' }, () => {}, new AbortController().signal)

    expect(publish).toHaveBeenCalledTimes(1)
  })

  it('entrega o sinal de cancelamento ao runner, que é quem encerra o Playwright', async () => {
    const control = new AbortController()
    let received: ScenarioRunOptions | undefined
    const useCase = new RunScenario(
      projects(),
      runner((options) => {
        received = options
      }),
      { publish: vi.fn() } as unknown as DomainEventBus
    )

    await useCase.stream('minha-loja', { grep: '@smoke' }, () => {}, control.signal)

    expect(received?.signal).toBe(control.signal)
  })
})

function failingRunner(events: RunEvent[], output = 'Error: Cannot find module playwright.config.ts'): ScenarioRunner {
  return {
    runProject: async () => ({ passed: false, output }),
    streamProject: async (_path: string, _options: ScenarioRunOptions, onEvent: (event: RunEvent) => void) => {
      for (const event of events) onEvent(event)

      return { passed: false, output }
    }
  } as unknown as ScenarioRunner
}

function crashingRunner(error: Error): ScenarioRunner {
  return {
    runProject: async () => {
      throw error
    },
    streamProject: async () => {
      throw error
    }
  } as unknown as ScenarioRunner
}

const bus = () => ({ publish: vi.fn() }) as unknown as DomainEventBus

describe('RunScenario: relato da execução que não chegou a rodar', () => {
  it('relata a execução que falhou sem nenhum teste rodar, com a saída do Playwright', async () => {
    const report = vi.fn().mockResolvedValue(true)
    const useCase = new RunScenario(projects(), failingRunner([]), bus(), report)

    await useCase.stream('minha-loja', { spec: 'tests/login.spec.ts' }, () => {})

    const [sent] = report.mock.lastCall!
    expect(sent.context).toBe('runner:stream')
    expect(sent.stack).toContain('Cannot find module playwright.config.ts')
  })

  it('conta como a execução foi pedida', async () => {
    const report = vi.fn().mockResolvedValue(true)
    const started: RunEvent = { event: 'run:started', steps: [] } as unknown as RunEvent
    const useCase = new RunScenario(projects(), failingRunner([started]), bus(), report)

    await useCase.stream('minha-loja', { spec: 'tests/login.spec.ts', grep: '@smoke' }, () => {})

    expect(report.mock.lastCall![0].details).toEqual({ spec: true, grep: true, events: 1 })
  })

  it('passa os valores do ambiente do projeto como segredos a mascarar', async () => {
    const report = vi.fn().mockResolvedValue(true)
    const useCase = new RunScenario(projects(), failingRunner([]), bus(), report)

    await useCase.stream('minha-loja', {}, () => {})

    expect(report.mock.lastCall![0].secrets).toEqual(['https://loja.test'])
  })

  it('manda só o fim de uma saída longa', async () => {
    const report = vi.fn().mockResolvedValue(true)
    const output = `${'x'.repeat(20_000)}FIM`
    const useCase = new RunScenario(projects(), failingRunner([], output), bus(), report)

    await useCase.stream('minha-loja', {}, () => {})

    const { stack } = report.mock.lastCall![0]
    expect(stack.length).toBeLessThanOrEqual(8_000)
    expect(stack.endsWith('FIM')).toBe(true)
  })

  it('não relata quando o teste da pessoa rodou e falhou', async () => {
    const report = vi.fn()
    const failed = { event: 'test', id: 't1', title: 'login', status: 'failed', durationMs: 10, error: 'expect falhou', videoPath: null } as RunEvent
    const useCase = new RunScenario(projects(), failingRunner([failed]), bus(), report)

    await useCase.stream('minha-loja', {}, () => {})

    expect(report).not.toHaveBeenCalled()
  })

  it('não relata a execução que passou', async () => {
    const report = vi.fn()
    const passing = {
      runProject: async () => ({ passed: true, output: 'ok' }),
      streamProject: async () => ({ passed: true, output: 'ok' })
    } as unknown as ScenarioRunner

    await new RunScenario(projects(), passing, bus(), report).stream('minha-loja', {}, () => {})

    expect(report).not.toHaveBeenCalled()
  })

  it('não relata a execução que a pessoa cancelou', async () => {
    const report = vi.fn()
    const control = new AbortController()
    const useCase = new RunScenario(projects(), runner(() => control.abort()), bus(), report)

    await useCase.stream('minha-loja', {}, () => {}, control.signal)

    expect(report).not.toHaveBeenCalled()
  })

  it('devolve o resultado mesmo quando o relato falha', async () => {
    const report = vi.fn().mockRejectedValue(new Error('sem rede'))
    const useCase = new RunScenario(projects(), failingRunner([]), bus(), report)

    await expect(useCase.stream('minha-loja', {}, () => {})).resolves.toMatchObject({ passed: false })
  })

  it('relata e repassa o erro quando o runner nem consegue começar', async () => {
    const report = vi.fn().mockResolvedValue(true)
    const crash = new Error('spawn node ENOENT')
    const useCase = new RunScenario(projects(), crashingRunner(crash), bus(), report)

    await expect(useCase.stream('minha-loja', {}, () => {})).rejects.toBe(crash)

    expect(report.mock.lastCall![0]).toMatchObject({ message: 'spawn node ENOENT', context: 'runner:stream' })
  })

  it('relata e repassa o erro quando a execução direta nem consegue começar', async () => {
    const report = vi.fn().mockResolvedValue(true)
    const crash = new Error('spawn node ENOENT')
    const useCase = new RunScenario(projects(), crashingRunner(crash), bus(), report)

    await expect(useCase.execute('minha-loja')).rejects.toBe(crash)

    expect(report.mock.lastCall![0]).toMatchObject({ message: 'spawn node ENOENT', context: 'runner:execute' })
  })
})
