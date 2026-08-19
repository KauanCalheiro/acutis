import { environmentListSchema } from '#shared/contracts/environment'
import { defineEventHandler, getRouterParam } from 'h3'
import { environmentUseCases } from '../../../../utils/composition/environment'
import { parseApiResponse } from '../../../../utils/contract'
import { execute } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  return parseApiResponse(
    environmentListSchema,
    await execute(() => environmentUseCases().list(slug ?? ''))
  )
})
