// @vitest-environment node
/** O recorte da tela em branco do começo do vídeo, feito pelo ffmpeg. */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, expect, it, vi } from 'vitest'

/** O ffmpeg falso: a primeira chamada inspeciona, a segunda recorta. */
const ffmpeg = vi.hoisted(() => ({
  stderr: '',
  fails: false,
  writesOutput: true,
  calls: [] as string[][]
}))

vi.mock('node:child_process', () => ({
  execFile: (
    _command: string,
    args: string[],
    _options: unknown,
    done: (error: Error | null, result?: { stdout: string, stderr: string }) => void
  ) => {
    ffmpeg.calls.push(args)

    if (ffmpeg.fails) {
      done(new Error('ffmpeg não está instalado'))

      return
    }

    const output = args.at(-1)!

    if (output.endsWith('.watchable.webm') && ffmpeg.writesOutput) writeFileSync(output, 'recorte')

    done(null, { stdout: '', stderr: ffmpeg.stderr })
  }
}))

const { watchableVideo } = await import('../run-video.js')

function video(): string {
  const file = join(mkdtempSync(join(tmpdir(), 'acutis-trim-')), 'last.webm')

  writeFileSync(file, 'gravação')

  return file
}

/** A saída do ffmpeg que descreve um vídeo com `blank` segundos em branco no começo. */
function detected(blank: number, duration = '00:00:20.00'): string {
  return `Duration: ${duration}, start: 0.000\nblack_start:0 black_end:${blank} black_duration:${blank}`
}

beforeEach(() => {
  ffmpeg.calls = []
  ffmpeg.fails = false
  ffmpeg.writesOutput = true
  ffmpeg.stderr = ''
})

it('recorta a abertura em branco e entrega o recorte', async () => {
  ffmpeg.stderr = detected(3)
  const file = video()

  const result = await watchableVideo(file)

  expect(result).toBe(file.replace('.webm', '.watchable.webm'))
  expect(ffmpeg.calls[1]).toContain('-ss')
  expect(ffmpeg.calls[1]).toContain('3')
})

it('entrega a gravação inteira quando ela não começa em branco', async () => {
  ffmpeg.stderr = 'Duration: 00:00:20.00, start: 0.000'
  const file = video()

  expect(await watchableVideo(file)).toBe(file)
  expect(ffmpeg.calls).toHaveLength(1)
})

it('não recorta vídeo que é quase todo em branco', async () => {
  ffmpeg.stderr = detected(19)
  const file = video()

  expect(await watchableVideo(file)).toBe(file)
  expect(ffmpeg.calls).toHaveLength(1)
})

it('entrega a gravação inteira quando o ffmpeg não roda', async () => {
  ffmpeg.fails = true
  const file = video()

  expect(await watchableVideo(file)).toBe(file)
})

it('entrega a gravação inteira quando o recorte não sai', async () => {
  ffmpeg.stderr = detected(3)
  ffmpeg.writesOutput = false
  const file = video()

  expect(await watchableVideo(file)).toBe(file)
})

it('trata como sem duração o vídeo que o ffmpeg não sabe medir', async () => {
  ffmpeg.stderr = 'black_start:0 black_end:3'
  const file = video()

  expect(await watchableVideo(file)).toBe(file)
})
