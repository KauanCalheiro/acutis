// @vitest-environment node
/** O endpoint que diz se a API está de pé e se há gravação em andamento. */
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../test/support/harness.js'
import { RecorderService } from '../webdriver/recorder/recorder.service.js'

let api: Harness

const recorder = { recording: false, isRecording: () => recorder.recording }

beforeEach(async () => {
  recorder.recording = false
  api = await startApi(
    [{
      providers: [{ provide: RecorderService, useValue: recorder }]
    }]
  )
})

afterEach(async () => {
  await api.close()
})

it('responde que está de pé, sem gravação nenhuma', async () => {
  const response = await api.http.get('/health')

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ ok: true, recording: false })
})

it('conta que há gravação em andamento', async () => {
  recorder.recording = true

  const response = await api.http.get('/health')

  expect(response.body).toEqual({ ok: true, recording: true })
})
