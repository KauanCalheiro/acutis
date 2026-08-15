/**
 * Os dois casos de uso que chamam modelo: `FixScenarioSpec` e `SuggestScenarioSelectors`.
 *
 * Sem provedor cadastrado, os dois continuam respondendo — com o objeto fixo do stub. É o que
 * mantém a tela funcionando numa instalação recém-criada, onde ninguém configurou IA ainda.
 */
import { Injectable } from '@nestjs/common'
import { readFileSync } from 'node:fs'
import { Url } from '../playwright/url.js'
import { Playwright } from '../playwright/playwright.js'
import { ProjectService } from '../project/project.service.js'
import { Scenario } from '../project/scenario/scenario.js'
import { ActiveVars } from '../playwright/active-vars.js'
import { EnvKey } from '../project/environment/env-key.js'
import { checkSpec } from '../rules/spec-rules.js'
import { SettingsService } from '../settings/settings.service.js'
import { fragileTargets, suggestSelectors } from './agents/selector.js'
import { fixSpec } from './agents/spec-fixer.js'
import { fixedSpec, fixedSuggestions, type FixedSpec, type SelectorSuggestion } from './stub.js'

@Injectable()
export class ScenarioAiService {
    constructor(
        private readonly projects: ProjectService,
        private readonly settings: SettingsService
    ) {}

    /**
     * Conserta o spec do cenário.
     *
     * As violações que o modelo recebe vêm das regras determinísticas, não de um segundo modelo: é o
     * que faz o julgamento ser o mesmo em toda execução.
     */
    async fix(slug: string, scenarioId: string): Promise<FixedSpec> {
        const scenario = this.scenarioOf(slug, scenarioId)

        if (!this.settings.canUseAi()) return fixedSpec()

        const environments = this.projects.environmentsOf(slug)
        const spec = readFileSync(scenario.file(), 'utf8')

        const baseUrl = environments.value(EnvKey.URL)
        const violations = baseUrl
            ? checkSpec(new Playwright(spec), new Url(baseUrl), new ActiveVars(environments.activeVars()))
            : []

        const fixed = await fixSpec(this.settings.resolved(), {
            spec,
            violations: violations.map(({ rule, message }) => ({ rule, message })),
            events: scenario.events()
        })

        return fixed
    }

    /** Sugere `data-testid` para os elementos da gravação que dependem de seletor frágil. */
    async suggestions(slug: string, scenarioId: string): Promise<SelectorSuggestion[]> {
        const scenario = this.scenarioOf(slug, scenarioId)

        if (!this.settings.canUseAi()) return fixedSuggestions()

        const events = scenario.events() as Record<string, unknown>[]
        const targets = fragileTargets(events)

        if (targets.length === 0) return []

        const { suggestions } = await suggestSelectors(this.settings.resolved(), targets)

        // O modelo devolve o `index` que recebeu; é por ele que a sugestão volta a apontar para o
        // elemento certo. Parear por ordem quebraria assim que ele embaralhasse os itens.
        return suggestions.flatMap((suggestion) => {
            const target = targets.find((candidate) => candidate.index === suggestion.index)

            if (!target) return []

            return [{
                event: `${target.type} em ${target.label}`.trim(),
                currentSelector: target.selector,
                suggestedTestId: suggestion.suggestedTestId,
                reason: suggestion.reason
            }]
        })
    }

    /** 404 de projeto e de cenário continuam valendo: é o contrato que a tela já trata. */
    private scenarioOf(slug: string, scenarioId: string): Scenario {
        const scenario = Scenario.make(this.projects.pathOf(slug), scenarioId)

        scenario.spec()

        return scenario
    }
}
