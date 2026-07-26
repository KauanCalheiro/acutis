const { readFileSync } = require('node:fs')

const MARKER = '@@ACUTIS_RUN@@'
const STEP_TITLE = /test\.step\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g

function emit(payload) {
    process.stdout.write(MARKER + JSON.stringify(payload) + '\n')
}

function declaredStepTitles(files) {
    const titles = []

    for (const file of files) {
        let source

        try {
            source = readFileSync(file, 'utf8')
        } catch {
            continue
        }

        for (const match of source.matchAll(STEP_TITLE)) {
            titles.push(match[2].replace(/\\(['"`\\])/g, '$1'))
        }
    }

    return titles
}

function firstError(errors) {
    const message = (errors && errors[0] && errors[0].message) || ''

    return message.replace(/\[[0-9;]*m/g, '').trim() || null
}

class StreamReporter {
    constructor() {
        this.openSteps = new Map()
    }

    onBegin(_config, suite) {
        const tests = suite.allTests()
        const files = [...new Set(tests.map((test) => test.location.file))]

        emit({ event: 'run:started', total: tests.length, steps: declaredStepTitles(files) })
    }

    onTestBegin(test) {
        emit({ event: 'test', id: test.id, title: test.title, status: 'pending' })
    }

    onStepBegin(test, _result, step) {
        if (step.category !== 'test.step') return

        const open = this.openSteps.get(test.id) ?? []
        open.push(step.title)
        this.openSteps.set(test.id, open)

        emit({ event: 'step', testId: test.id, title: step.title, status: 'pending' })
    }

    onStepEnd(test, _result, step) {
        if (step.category !== 'test.step') return

        this.closeStep(test.id, step.title)

        emit({
            event: 'step',
            testId: test.id,
            title: step.title,
            status: step.error ? 'failed' : 'success',
            durationMs: step.duration,
            error: step.error ? firstError([step.error]) : null,
        })
    }

    closeStep(testId, title) {
        const open = this.openSteps.get(testId) ?? []
        const index = open.lastIndexOf(title)

        if (index >= 0) open.splice(index, 1)
    }

    failOpenSteps(test, error) {
        for (const title of this.openSteps.get(test.id) ?? []) {
            emit({ event: 'step', testId: test.id, title, status: 'failed', durationMs: 0, error })
        }

        this.openSteps.delete(test.id)
    }

    onTestEnd(test, result) {
        const status = result.status === 'passed'
            ? 'success'
            : result.status === 'skipped'
                ? 'skipped'
                : 'failed'

        if (status === 'failed') {
            this.failOpenSteps(test, firstError(result.errors))
        }

        const video = result.attachments.find((a) => a.name === 'video')

        emit({
            event: 'test',
            id: test.id,
            title: test.title,
            status,
            durationMs: result.duration,
            error: status === 'failed' ? firstError(result.errors) : null,
            videoPath: video ? video.path : null,
        })
    }

    onEnd(result) {
        emit({ event: 'run:finished', status: result.status, passed: result.status === 'passed' })
    }
}

module.exports = StreamReporter
