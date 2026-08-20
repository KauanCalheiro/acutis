import { writeTestRequestSchema, writeTestResponseSchema } from '#shared/contracts/generation'
import { defineEventHandler, getRouterParam } from 'h3'
import { generationUseCases } from '../../../utils/composition/generation'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, writeTestRequestSchema)
  const useCases = await generationUseCases()
  const written = await execute(() => useCases.generation.write(
    getRouterParam(event, 'slug') ?? '',
    body
  ))

  const response = { ...written, testRun: null }
  return parseApiResponse(writeTestResponseSchema, response)
})
