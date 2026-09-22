import { selectorPriorityResponseSchema, selectorPrioritySchema } from '#shared/contracts/project'
import { defineEventHandler, getRouterParam } from 'h3'
import { projectUseCases } from '../../../utils/composition/project'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, selectorPrioritySchema)
  const selectors = await execute(() => projectUseCases().projects.setSelectorPriority(
    getRouterParam(event, 'slug') ?? '',
    body.selectors
  ))

  return parseApiResponse(selectorPriorityResponseSchema, { selectors })
})
