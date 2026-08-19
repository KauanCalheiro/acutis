import { authSetupSchema } from '#shared/contracts/auth'
import { defineEventHandler, getRouterParam } from 'h3'
import { authUseCases } from '../../../utils/composition/auth'
import { parseApiResponse } from '../../../utils/contract'
import { execute } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const auth = await authUseCases()
  const response = await execute(() => auth.show(getRouterParam(event, 'slug') ?? ''))

  return parseApiResponse(authSetupSchema, { authSetup: response })
})
