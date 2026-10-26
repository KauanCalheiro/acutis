import { defineEventHandler, sendNoContent } from 'h3'
import { projectUseCases } from '../utils/composition/project'
import { execute } from '../utils/http'

export default defineEventHandler(async (event) => {
  await execute(() => projectUseCases().demoProject.revoke())
  return sendNoContent(event)
})
