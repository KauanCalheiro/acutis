import { defineEventHandler, getRouterParam, setHeader, sendStream, createError } from 'h3'
import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'

const TMP_DIR = join(process.cwd(), '.tmp', 'recordings')

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')!
  if (!/^[a-f0-9-]{36}$/.test(id)) throw createError({ statusCode: 400 })

  const path = join(TMP_DIR, `${id}.webm`)
  if (!existsSync(path)) throw createError({ statusCode: 404 })

  setHeader(event, 'Content-Type', 'video/webm')
  return sendStream(event, createReadStream(path))
})
