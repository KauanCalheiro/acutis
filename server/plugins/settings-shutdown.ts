import { closeSettings } from '../utils/composition/settings'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeSettings)
})
