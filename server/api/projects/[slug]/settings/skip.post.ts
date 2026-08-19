import { defineEventHandler, getRouterParam, sendNoContent } from 'h3'
import { projectUseCases } from '../../../../utils/composition/project'
import { execute } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  await execute(() => projectUseCases().projects.skipUrl(getRouterParam(event, 'slug') ?? ''))
  return sendNoContent(event)
})
