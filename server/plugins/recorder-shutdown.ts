import { recorderService } from '../utils/composition/recorder'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    await recorderService.stop()
  })
})
