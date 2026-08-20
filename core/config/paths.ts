import { existsSync, readFileSync } from 'node:fs'
import { dirname, parse, resolve } from 'node:path'

function packageRoot(): string {
  const starts = [process.argv[1] ? dirname(resolve(process.argv[1])) : '', process.cwd()]

  for (const start of starts) {
    let current = start
    const filesystemRoot = parse(current).root

    while (current !== filesystemRoot) {
      const manifest = resolve(current, 'package.json')
      if (existsSync(manifest)) {
        try {
          const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }
          if (pkg.name === 'acutis') return current
        } catch {
          current = dirname(current)
          continue
        }
      }
      current = dirname(current)
    }
  }

  return process.cwd()
}

export const PACKAGE_ROOT = packageRoot()

export const VIDEOS_DIR = resolve(PACKAGE_ROOT, '.tmp/videos')
export const RUNNER_DIR = resolve(PACKAGE_ROOT, '.tmp/runner')
export const STREAM_REPORTER_PATH = resolve(PACKAGE_ROOT, 'reporters/stream-reporter.cjs')
export const RECORDER_BUNDLE_PATH = resolve(PACKAGE_ROOT, 'dist-ui/driver-entry.js')
