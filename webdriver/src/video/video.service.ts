import { Injectable } from '@nestjs/common'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { VIDEOS_DIR } from '../config/paths.js'

@Injectable()
export class VideoService {
    path(sessionId: string): string {
        return join(VIDEOS_DIR, `${sessionId}.webm`)
    }

    async ensureDir(): Promise<void> {
        await mkdir(VIDEOS_DIR, { recursive: true })
    }

    exists(sessionId: string): boolean {
        return existsSync(this.path(sessionId))
    }

    openStream(sessionId: string): Readable {
        return createReadStream(this.path(sessionId))
    }

    async delete(sessionId: string): Promise<void> {
        await unlink(this.path(sessionId)).catch(() => { })
    }
}
