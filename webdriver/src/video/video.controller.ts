import {
    Controller,
    Delete,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Res,
} from '@nestjs/common'
import type { Writable } from 'node:stream'
import { VideoService } from './video.service.js'

@Controller('recording')
export class VideoController {
    constructor(
        private readonly videoService: VideoService,
    ) { }

    @Get(':sessionId')
    @Header('Content-Type', 'video/webm')
    stream(@Param('sessionId') sessionId: string, @Res() res: Writable): void {
        if (!this.videoService.exists(sessionId)) {
            throw new NotFoundException()
        }

        this.videoService.openStream(sessionId).pipe(res)
    }

    @Delete(':sessionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('sessionId') sessionId: string): Promise<void> {
        await this.videoService.delete(sessionId)
    }
}
