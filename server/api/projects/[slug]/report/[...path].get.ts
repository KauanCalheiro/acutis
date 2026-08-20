import { createReadStream } from 'node:fs'
import { defineEventHandler, getRouterParam, sendStream } from 'h3'
import { projectUseCases } from '../../../../utils/composition/project'
import { execute } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const file = await execute(() => projectUseCases().projects.reportFile(
    getRouterParam(event, 'slug') ?? '',
    getRouterParam(event, 'path') ?? ''
  ))

  return sendStream(event, createReadStream(file))
})
