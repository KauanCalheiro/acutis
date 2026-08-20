import { authCredentialsRequestSchema } from '#shared/contracts/auth'
import { defineEventHandler, getRouterParam, sendNoContent } from 'h3'
import { projectUseCases } from '../../../../utils/composition/project'
import { execute, validatedBody } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, authCredentialsRequestSchema)
  await execute(() => projectUseCases().projects.saveCredentials(
    getRouterParam(event, 'slug') ?? '',
    body.username,
    body.password
  ))
  return sendNoContent(event)
})
