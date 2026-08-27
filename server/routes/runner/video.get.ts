import { watchableVideo } from '@acutis/core/webdriver/runner/run-video.js'
import { existsSync } from 'node:fs'
import { createError, defineEventHandler, getQuery } from 'h3'
import { sendVideoFile } from '../../utils/video-file'

export default defineEventHandler(async (event) => {
  const requested = getQuery(event).path
  const path = typeof requested === 'string' ? requested : ''
  if (!path.endsWith('.webm') || !existsSync(path)) throw createError({ statusCode: 404 })

  return sendVideoFile(event, await watchableVideo(path))
})
