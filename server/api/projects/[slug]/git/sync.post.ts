import { projectSyncSchema } from '#shared/contracts/project'
import { defineEventHandler, getRouterParam } from 'h3'
import { projectUseCases } from '../../../../utils/composition/project'
import { parseApiResponse } from '../../../../utils/contract'
import { execute } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const result = await execute(() => projectUseCases().projects.sync(getRouterParam(event, 'slug') ?? ''))

  return parseApiResponse(projectSyncSchema, result)
})
