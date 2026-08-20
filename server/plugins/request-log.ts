import { completeRequestLog, startRequestLog } from '@acutis/core/common/interceptors/request-log.interceptor.js'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', startRequestLog)
  nitroApp.hooks.hook('afterResponse', (event, response) => {
    completeRequestLog(event, response?.body)
  })
  nitroApp.hooks.hook('error', (error, context) => {
    if (context.event) completeRequestLog(context.event, undefined, error)
  })
})
