import { createError, defineEventHandler } from 'h3'
import { z } from 'zod'
import { APP_CONFIG } from '@acutis/core/config/env'
import { recorderService } from '../../utils/composition/recorder'
import { validatedBody } from '../../utils/http'

const bodySchema = z.object({ selector: z.string().min(1) })

export default defineEventHandler(async (event) => {
  if (!APP_CONFIG.webdriverTestMode) {
    throw createError({ statusCode: 403, message: 'debug endpoints only available with WEBDRIVER_TEST_MODE=1' })
  }

  const body = await validatedBody(event, bodySchema)
  await recorderService.debugClick(body.selector)

  return { ok: true as const }
})
