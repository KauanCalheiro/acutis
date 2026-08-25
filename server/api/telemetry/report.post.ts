import { errorReportRequestSchema, errorReportResponseSchema } from '#shared/contracts/telemetry'
import { defineEventHandler } from 'h3'
import { telemetryReporter } from '../../utils/composition/telemetry'
import { parseApiResponse } from '../../utils/contract'
import { validatedBody } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const report = await validatedBody(event, errorReportRequestSchema)

  return parseApiResponse(errorReportResponseSchema, { sent: await telemetryReporter().report(report) })
})
