// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { RunScenario } from '../run-scenario.js'
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
