import { defineEventHandler } from 'h3'
import { recorderService } from '../../utils/composition/recorder'

export default defineEventHandler(async () => {
  await recorderService.debugClosePage()

  return { ok: true as const }
})
