import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { environmentUseCases } from '../../../../utils/composition/environment'
import { execute } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const environment = getRouterParam(event, 'environment')

  await execute(() => environmentUseCases().remove(slug ?? '', environment ?? ''))

  setResponseStatus(event, 204)

  return null
})
