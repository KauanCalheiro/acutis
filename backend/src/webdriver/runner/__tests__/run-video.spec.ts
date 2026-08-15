// @vitest-environment node
import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { watchableVideo } from '../run-video.js'

function videoPair(watchableAgeSeconds: number): { video: string, watchable: string } {
    const dir = mkdtempSync(join(tmpdir(), 'acutis-video-'))
    const video = join(dir, 'last.webm')
    const watchable = join(dir, 'last.watchable.webm')

    writeFileSync(video, 'gravação')
    writeFileSync(watchable, 'recorte')

    const now = Date.now() / 1000
    utimesSync(video, now, now)
    utimesSync(watchable, now + watchableAgeSeconds, now + watchableAgeSeconds)

    return { video, watchable }
}

describe('watchableVideo', () => {
    it('reaproveita o recorte feito para esta mesma gravação', async () => {
        const { video, watchable } = videoPair(1)

        expect(await watchableVideo(video)).toBe(watchable)
    })

    it('descarta o recorte que sobrou de uma execução anterior', async () => {
        const { video, watchable } = videoPair(-3600)

        expect(await watchableVideo(video)).not.toBe(watchable)
    })
})
