import { defineEventHandler, getRouterParam, sendNoContent } from 'h3'
import { authUseCases } from '../../../../utils/composition/auth'
import { execute } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const auth = await authUseCases()
  await execute(() => auth.skip(getRouterParam(event, 'slug') ?? ''))
  return sendNoContent(event)
})
