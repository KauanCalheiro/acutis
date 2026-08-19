import { recorderService } from '../utils/composition/recorder'
import { createRecorderWebSocketHooks } from '../utils/recorder-websocket'

export default defineWebSocketHandler(createRecorderWebSocketHooks(recorderService))
