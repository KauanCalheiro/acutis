import { resolve } from 'node:path'
import { RecorderService } from '@acutis/core/webdriver/recorder/recorder.service'
import { VideoService } from '@acutis/core/webdriver/video/video.service'

const videoService = new VideoService()

videoService.configureDirectory(resolve(process.cwd(), '.tmp/videos'))

export const recorderService = new RecorderService(videoService)

recorderService.configureBundleLoader(async () => {
  const bundle = await useStorage('assets:recorder').getItem<string>('driver-entry.js')
  if (!bundle) throw new Error('Bundle do recorder não encontrado.')

  return bundle
})
export { videoService }
