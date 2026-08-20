import { projectSchema, updateProjectSchema } from '#shared/contracts/project'
import { defineEventHandler, getRouterParam } from 'h3'
import { projectUseCases } from '../../utils/composition/project'
import { parseApiResponse } from '../../utils/contract'
import { execute, validatedBody } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, updateProjectSchema)
  const response = await execute(() => projectUseCases().projects.update(
    getRouterParam(event, 'slug') ?? '',
    body.name
  ))

  return parseApiResponse(projectSchema, response)
})
