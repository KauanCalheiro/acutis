/**
 * Os dois casos de uso que chamavam modelo: `FixScenarioSpec` e `SuggestScenarioSelectors`.
 *
 * O que sobrou deles é o que nunca dependeu de IA — achar o projeto e o cenário, e responder 404
 * quando não existem. A resposta em si vem do stub, e nada é executado nem gravado no caminho: sem
 * geração não há spec a rodar para colher o HTML da página quebrada.
 */
import { Injectable } from '@nestjs/common'
import { ProjectService } from '../project/project.service.js'
import { Scenario } from '../project/scenario/scenario.js'
import { fixedSpec, fixedSuggestions, type FixedSpec, type SelectorSuggestion } from './stub.js'

@Injectable()
export class ScenarioAiService {
    constructor(private readonly projects: ProjectService) {}

    fix(slug: string, scenarioId: string): FixedSpec {
        this.ensureExists(slug, scenarioId)

        return fixedSpec()
    }

    suggestions(slug: string, scenarioId: string): SelectorSuggestion[] {
        this.ensureExists(slug, scenarioId)

        return fixedSuggestions()
    }

    /** 404 de projeto e de cenário continuam valendo: é o contrato que a tela já trata. */
    private ensureExists(slug: string, scenarioId: string): void {
        Scenario.make(this.projects.pathOf(slug), scenarioId).spec()
    }
}
