import { createReadStream, existsSync } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { VIDEOS_DIR } from '../../config/paths.js'

export class VideoService {
  private directory: string | null = null

  configureDirectory(directory: string): void {
    this.directory = directory
  }

  private getDirectory(): string {
    return this.directory ?? VIDEOS_DIR
  }

  path(sessionId: string): string {
    return join(this.getDirectory(), `${sessionId}.webm`)
  }

  async ensureDir(): Promise<void> {
    await mkdir(this.getDirectory(), { recursive: true })
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
