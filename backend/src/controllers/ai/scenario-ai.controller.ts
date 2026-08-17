/** Os endpoints de cenário que chamam modelo; o id aceita barra (`checkout/pagar`). */
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common'
import { ScenarioFixDto } from '../../dto/ai/scenario-fix.dto.js'
import type { FixedSpec, SelectorSuggestion } from '@acutis/contracts/scenario'
import { ScenarioAiUseCases } from '../../use-cases/ai/scenario-ai.use-cases.js'

@Controller('api/v1/projects')
export class ScenarioAiController {
    constructor(private readonly scenarios: ScenarioAiUseCases) {}

    @Post(':project/scenarios/:scenario(*)/fix')
    @HttpCode(200)
    fix(
        @Param('project') slug: string,
        @Param('scenario') scenarioId: string,
        @Body() _dto: ScenarioFixDto
    ): Promise<FixedSpec> {
        return this.scenarios.fix(slug, scenarioId)
    }

    @Post(':project/scenarios/:scenario(*)/suggestions')
    @HttpCode(200)
    suggestions(
        @Param('project') slug: string,
        @Param('scenario') scenarioId: string
    ): Promise<SelectorSuggestion[]> {
        return this.scenarios.suggestions(slug, scenarioId)
    }
}
