import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const FFMPEG_MAX_OUTPUT = 10 * 1024 * 1024
const BLANK_AT_START = /black_start:0(?:\.0+)? black_end:([\d.]+)/
const DURATION = /Duration: (\d+):(\d+):([\d.]+)/
const MOSTLY_BLANK = 0.9

async function inspect(video: string): Promise<{ blankIntroEnd: number, duration: number }> {
    const { stderr } = await exec(
        'ffmpeg',
        ['-hide_banner', '-i', video, '-vf', 'negate,blackdetect=d=0.05:pix_th=0.10', '-map', '0:v', '-f', 'null', '-'],
        { maxBuffer: FFMPEG_MAX_OUTPUT },
    )

    const duration = stderr.match(DURATION)

    return {
        blankIntroEnd: Number(stderr.match(BLANK_AT_START)?.[1] ?? 0),
        duration: duration
            ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
            : 0,
    }
}

/**
 * Recorte mais velho que a gravação é descartado: toda execução sobrescreve o mesmo `last.webm`.
 */
function isFresh(watchable: string, video: string): boolean {
    try {
        return statSync(watchable).mtimeMs >= statSync(video).mtimeMs
    } catch {
        return false
    }
}

export async function watchableVideo(video: string): Promise<string> {
    const watchable = video.replace(/\.webm$/, '.watchable.webm')

    if (existsSync(watchable) && isFresh(watchable, video)) {
        return watchable
    }

    try {
        const { blankIntroEnd, duration } = await inspect(video)

        if (blankIntroEnd <= 0 || blankIntroEnd >= duration * MOSTLY_BLANK) {
            return video
        }

        await exec(
            'ffmpeg',
            [
                '-hide_banner', '-y',
                '-ss', String(blankIntroEnd),
                '-i', video,
                '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '32', '-b:v', '0',
                watchable,
            ],
            { maxBuffer: FFMPEG_MAX_OUTPUT },
        )
    } catch {
        return video
    }

    return existsSync(watchable) ? watchable : video
}
