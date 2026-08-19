import { APP_CONFIG } from '@acutis/core/config/env.js'
import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { runnerSpecRequestSchema } from '#shared/contracts/runner'
import { executionRunner } from '../../utils/composition/execution'
import { validatedBody } from '../../utils/http'

export default defineEventHandler(async (event) => {
  if (!APP_CONFIG.webdriverTestMode) {
    throw createError({ statusCode: 403, message: 'runner endpoints only available with WEBDRIVER_TEST_MODE=1' })
  }

  const body = await validatedBody(event, runnerSpecRequestSchema)
  const response = await executionRunner().run(body.spec, { baseUrl: body.baseUrl, env: body.env })

  setResponseStatus(event, 201)
  return response
})
