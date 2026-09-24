import { recorderService } from '../utils/composition/recorder'
import { telemetryReporter } from '../utils/composition/telemetry'
import { createRecorderWebSocketHooks } from '../utils/recorder-websocket'

export default defineWebSocketHandler(createRecorderWebSocketHooks(recorderService, report => telemetryReporter().report(report)))
