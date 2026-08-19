import { defineEventHandler, getRouterParam, readRawBody, createError, handleCors } from 'h3'
import { writeFile } from 'node:fs/promises'
import { videoService } from '../../utils/composition/recorder'

export default defineEventHandler(async (event) => {
  handleCors(event, { origin: '*', methods: ['POST'] })

  const id = getRouterParam(event, 'id')!
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw createError({ statusCode: 400 })

  const body = await readRawBody(event, false) as Buffer
  await videoService.ensureDir()
  await writeFile(videoService.path(id), body)
  return { ok: true }
})
