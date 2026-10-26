import { projectSchema } from '#shared/contracts/project'
import { defineEventHandler, setResponseStatus } from 'h3'
import { prepareProjectTemplates, projectUseCases } from '../utils/composition/project'
import { parseApiResponse } from '../utils/contract'
import { execute } from '../utils/http'

export default defineEventHandler(async (event) => {
  await prepareProjectTemplates()
  const { project, created } = await execute(() => projectUseCases().demoProject.create())

  setResponseStatus(event, created ? 201 : 200)

  return parseApiResponse(projectSchema, project)
})
