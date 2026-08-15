import {
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { VideoService } from './video.service.js'

@Controller('recording')
export class VideoController {
    constructor(
        private readonly videoService: VideoService,
    ) { }

    @Get(':sessionId')
    stream(@Param('sessionId') sessionId: string, @Res() res: Response): void {
        if (!this.videoService.exists(sessionId)) {
            throw new NotFoundException()
        }

        res.sendFile(this.videoService.path(sessionId))
    }

    @Delete(':sessionId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('sessionId') sessionId: string): Promise<void> {
        await this.videoService.delete(sessionId)
    }
}
