import { captureUnhandledError } from '../utils/composition/telemetry'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', captureUnhandledError)
})
