import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { recorderService } from '../../utils/composition/recorder'
import { validatedBody } from '../../utils/http'

const bodySchema = z.object({
  selector: z.string().min(1),
  value: z.string()
})

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, bodySchema)
  await recorderService.debugFill(body.selector, body.value)

  return { ok: true as const }
})
