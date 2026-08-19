import { scenarioSuggestionsRequestSchema, selectorSuggestionSchema } from '#shared/contracts/scenario'
import { defineEventHandler, getRouterParam } from 'h3'
import * as z from 'zod'
import { generationUseCases } from '../../../utils/composition/generation'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, scenarioSuggestionsRequestSchema)
  const useCases = await generationUseCases()
  const response = await execute(() => useCases.scenarios.suggestions(
    getRouterParam(event, 'slug') ?? '',
    body.scenarioId
  ))

  return parseApiResponse(z.array(selectorSuggestionSchema), response)
})
