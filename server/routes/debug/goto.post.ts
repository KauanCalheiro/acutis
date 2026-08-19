import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { recorderService } from '../../utils/composition/recorder'
import { validatedBody } from '../../utils/http'

const bodySchema = z.object({ url: z.url() })

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, bodySchema)
  await recorderService.debugGoto(body.url)

  return { ok: true as const }
})
