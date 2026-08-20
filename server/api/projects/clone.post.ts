import { cloneProjectSchema, projectSchema } from '#shared/contracts/project'
import { defineEventHandler, setResponseStatus } from 'h3'
import { projectUseCases } from '../../utils/composition/project'
import { parseApiResponse } from '../../utils/contract'
import { execute, validatedBody } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, cloneProjectSchema)
  const response = await execute(() => projectUseCases().cloneProject.execute(body))

  setResponseStatus(event, 201)

  return parseApiResponse(projectSchema, response)
})
