import { resolve } from 'node:path'

export const VIDEOS_DIR = resolve(import.meta.dirname, '../../.tmp/videos')
export const RUNNER_DIR = resolve(import.meta.dirname, '../../.tmp/runner')
export const STREAM_REPORTER_PATH = resolve(import.meta.dirname, '../../reporters/stream-reporter.cjs')
export const RECORDER_BUNDLE_PATH = resolve(import.meta.dirname, '../../dist-ui/driver-entry.js')
