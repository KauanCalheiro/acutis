/**
 * Os dois casos de uso que chamam modelo: consertar o spec e sugerir seletores. Sem provedor
 * cadastrado os dois seguem respondendo, com o que vem do stub.
 */
import { readFileSync } from 'node:fs'
import { Url } from '../../common/playwright/url.js'
import { Playwright } from '../../common/playwright/playwright.js'
import type { ProjectService } from '../project/project.service.js'
import { Scenario } from '../scenario/providers/scenario.js'
import { ActiveVars } from '../../common/playwright/active-vars.js'
import { EnvKey } from '../environment/providers/env-key.js'
import { checkSpec } from '../rules/spec-rules.js'
import type { SettingsService } from '../settings/settings.service.js'
import { fragileTargets, suggestSelectors } from './agents/selector.js'
import { fixSpec } from './agents/spec-fixer.js'
import { fixedSpec, fixedSuggestions, type FixedSpec, type SelectorSuggestion } from './providers/disabled.js'

export type { FixedSpec, SelectorSuggestion } from './providers/disabled.js'

export class ScenarioAiService {
  constructor(
    private readonly projects: ProjectService,
    private readonly settings: SettingsService
  ) {}

  /** Conserta o spec do cenário, mandando ao modelo o que as regras apontaram. */
  async fix(slug: string, scenarioId: string): Promise<FixedSpec> {
    const scenario = this.scenarioOf(slug, scenarioId)

    if (!await this.settings.canUseAi()) return fixedSpec()

    const environments = this.projects.environmentsOf(slug)
    const spec = readFileSync(scenario.file(), 'utf8')

    const baseUrl = environments.value(EnvKey.URL)
    const violations = baseUrl
      ? checkSpec(new Playwright(spec), new Url(baseUrl), new ActiveVars(environments.activeVars()))
      : []

    const fixed = await fixSpec(await this.settings.resolved(), {
      spec,
      violations: violations.map(({ rule, message }) => ({ rule, message })),
      events: scenario.events()
    })

    return fixed
  }

  /** Sugere `data-testid` para os elementos da gravação que dependem de seletor frágil. */
  async suggestions(slug: string, scenarioId: string): Promise<SelectorSuggestion[]> {
    const scenario = this.scenarioOf(slug, scenarioId)

    if (!await this.settings.canUseAi()) return fixedSuggestions()

    const events = scenario.events() as Record<string, unknown>[]
    const targets = fragileTargets(events)

    if (targets.length === 0) return []

    const { suggestions } = await suggestSelectors(await this.settings.resolved(), targets)

    // A sugestão volta ao elemento pelo `index` que o modelo recebeu, nunca pela ordem.
    return suggestions.flatMap((suggestion) => {
      const target = targets.find(candidate => candidate.index === suggestion.index)

      if (!target) return []

      return [{
        event: `${target.type} em ${target.label}`.trim(),
        currentSelector: target.selector,
        suggestedTestId: suggestion.suggestedTestId,
        reason: suggestion.reason
      }]
    })
  }

  /** O cenário do projeto; 404 quando qualquer um dos dois não existe. */
  private scenarioOf(slug: string, scenarioId: string): Scenario {
    const scenario = Scenario.make(this.projects.pathOf(slug), scenarioId)

    scenario.spec()

    return scenario
  }
}
