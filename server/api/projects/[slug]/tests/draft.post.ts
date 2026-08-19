import { draftRecordingRequestSchema, testDraftSchema } from '#shared/contracts/generation'
import { defineEventHandler, getRouterParam } from 'h3'
import { generationUseCases } from '../../../../utils/composition/generation'
import { parseApiResponse } from '../../../../utils/contract'
import { execute, validatedBody } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, draftRecordingRequestSchema)
  const useCases = await generationUseCases()
  const response = await execute(() => useCases.generation.draft(
    getRouterParam(event, 'slug') ?? '',
    body
  ))

  return parseApiResponse(testDraftSchema, response)
})
