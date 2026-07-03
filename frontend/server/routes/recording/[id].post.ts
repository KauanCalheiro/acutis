import { defineEventHandler, getRouterParam, readRawBody, createError, handleCors } from 'h3'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const TMP_DIR = join(process.cwd(), '.tmp', 'recordings')

export default defineEventHandler(async (event) => {
  handleCors(event, { origin: '*', methods: ['POST'] })

  const id = getRouterParam(event, 'id')!
  if (!/^[a-f0-9-]{36}$/.test(id)) throw createError({ statusCode: 400 })

  const body = await readRawBody(event, false) as Buffer
  await mkdir(TMP_DIR, { recursive: true })
  await writeFile(join(TMP_DIR, `${id}.webm`), body)
  return { ok: true }
})
