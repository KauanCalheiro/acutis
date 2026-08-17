import { selectorSuggestionSchema, type ScenarioSuggestionsRequest } from '@acutis/contracts/scenario'
import * as z from 'zod'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const { scenarioId } = await readBody<ScenarioSuggestionsRequest>(event)

  const response = await acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}/scenarios/${scenarioId}/suggestions`, {
    method: 'POST'
  })
  return parseApiResponse(z.array(selectorSuggestionSchema), response)
})
