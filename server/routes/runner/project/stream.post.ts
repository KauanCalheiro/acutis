import { APP_CONFIG } from '@acutis/core/config/env.js'
import { defineEventHandler, setHeader, setResponseStatus } from 'h3'
import type { RunEvent } from '@acutis/core/common/types/run.js'
import { runnerProjectRequestSchema } from '#shared/contracts/runner'
import { executionRunner } from '../../../utils/composition/execution'
import { validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  if (!APP_CONFIG.webdriverTestMode) {
    setResponseStatus(event, 403)
    return { message: 'runner endpoints only available with WEBDRIVER_TEST_MODE=1' }
  }

  const body = await validatedBody(event, runnerProjectRequestSchema)
  const response = event.node.res
  let finished: RunEvent | null = null

  setHeader(event, 'Content-Type', 'application/x-ndjson')
  const result = await executionRunner().streamProject(
    body.path,
    { spec: body.spec, grep: body.grep, env: body.env },
    (message) => {
      if (message.event === 'run:finished') finished = message
      else response.write(`${JSON.stringify(message)}\n`)
    }
  )
  const end: RunEvent = finished ?? { event: 'run:finished', status: 'failed', passed: false }

  response.end(`${JSON.stringify(result.passed ? end : { ...end, output: result.output })}\n`)
})
