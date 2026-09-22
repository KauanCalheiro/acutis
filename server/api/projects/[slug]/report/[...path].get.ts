import { defineEventHandler, getRouterParam } from 'h3'
import { projectUseCases } from '../../../../utils/composition/project'
import { execute } from '../../../../utils/http'
import { sendReportFile } from '../../../../utils/report-file'

export default defineEventHandler(async (event) => {
  const file = await execute(() => projectUseCases().projects.reportFile(
    getRouterParam(event, 'slug') ?? '',
    getRouterParam(event, 'path') ?? ''
  ))

  return sendReportFile(event, file)
})
