import { authRecordingRequestSchema, generatedAuthSetupSchema } from '#shared/contracts/auth'
import { defineEventHandler, getRouterParam } from 'h3'
import { authUseCases } from '../../../../utils/composition/auth'
import { parseApiResponse } from '../../../../utils/contract'
import { execute, validatedBody } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, authRecordingRequestSchema)
  const auth = await authUseCases()
  const response = await execute(() => auth.record(getRouterParam(event, 'slug') ?? '', body))

  return parseApiResponse(generatedAuthSetupSchema, response)
})
