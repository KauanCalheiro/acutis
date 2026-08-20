import { defineEventHandler, setResponseStatus } from 'h3'
import { runnerSpecRequestSchema } from '#shared/contracts/runner'
import { executionRunner } from '../../utils/composition/execution'
import { validatedBody } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, runnerSpecRequestSchema)
  const response = await executionRunner().run(body.spec, { baseUrl: body.baseUrl, env: body.env })

  setResponseStatus(event, 201)
  return response
})
