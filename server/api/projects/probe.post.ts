import { probeRepositoryRequestSchema, probeRepositoryResponseSchema } from '#shared/contracts/git'
import { defineEventHandler } from 'h3'
import { projectUseCases } from '../../utils/composition/project'
import { parseApiResponse } from '../../utils/contract'
import { execute, validatedBody } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, probeRepositoryRequestSchema)
  const response = await execute(() => projectUseCases().git.probe(body.url))

  return parseApiResponse(probeRepositoryResponseSchema, response)
})
