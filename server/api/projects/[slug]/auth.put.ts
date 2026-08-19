import { authSetupSchema, updateAuthSetupRequestSchema } from '#shared/contracts/auth'
import { defineEventHandler, getRouterParam } from 'h3'
import { authUseCases } from '../../../utils/composition/auth'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, updateAuthSetupRequestSchema)
  const auth = await authUseCases()
  const response = await execute(() => auth.update(getRouterParam(event, 'slug') ?? '', body.authSetup))

  return parseApiResponse(authSetupSchema, { authSetup: response })
})
