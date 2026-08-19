import { environmentSchema } from '#shared/contracts/environment'
import { defineEventHandler, getRouterParam } from 'h3'
import { environmentUseCases } from '../../../../../utils/composition/environment'
import { parseApiResponse } from '../../../../../utils/contract'
import { execute } from '../../../../../utils/http'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const environment = getRouterParam(event, 'environment')

  const response = await execute(() => environmentUseCases().activate(slug ?? '', environment ?? ''))

  return parseApiResponse(environmentSchema, response)
})
