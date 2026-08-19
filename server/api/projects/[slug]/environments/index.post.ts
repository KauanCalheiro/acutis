import { environmentRequestSchema, environmentSchema } from '#shared/contracts/environment'
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { environmentUseCases } from '../../../../utils/composition/environment'
import { parseApiResponse } from '../../../../utils/contract'
import { execute, validatedBody } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const body = await validatedBody(event, environmentRequestSchema)
  const response = await execute(() => environmentUseCases().create(slug ?? '', body.name))

  setResponseStatus(event, 201)

  return parseApiResponse(environmentSchema, response)
})
