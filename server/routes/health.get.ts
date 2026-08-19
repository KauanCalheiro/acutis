import { defineEventHandler } from 'h3'
import { recorderService } from '../utils/composition/recorder'

export default defineEventHandler(() => ({
  ok: true,
  recording: recorderService.isRecording()
}))
