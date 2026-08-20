import { defineEventHandler, getRouterParam, sendNoContent } from 'h3'
import { scenarioUseCases } from '../../../../utils/composition/scenario'
import { execute } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  await execute(() => scenarioUseCases().remove(
    getRouterParam(event, 'slug') ?? '',
    getRouterParam(event, 'scenario') ?? ''
  ))
  return sendNoContent(event)
})
