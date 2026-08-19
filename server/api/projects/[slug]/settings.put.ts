import { projectBaseUrlResponseSchema, projectSettingsSchema } from '#shared/contracts/project'
import { defineEventHandler, getRouterParam } from 'h3'
import { projectUseCases } from '../../../utils/composition/project'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, projectSettingsSchema)
  const baseUrl = await execute(() => projectUseCases().projects.setBaseUrl(
    getRouterParam(event, 'slug') ?? '',
    body.baseUrl
  ))

  const response = { base_url: baseUrl }
  return parseApiResponse(projectBaseUrlResponseSchema, response)
})
