import { Module } from '@nestjs/common'
import { RecorderModule } from '../recorder/recorder.module.js'
import { RecorderGateway } from './recorder.gateway.js'

@Module({
    imports: [RecorderModule],
    providers: [RecorderGateway],
})
export class WsModule { }
