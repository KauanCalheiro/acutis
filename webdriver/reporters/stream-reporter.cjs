const MARKER = '@@ACUTIS_RUN@@'

function emit(payload) {
    process.stdout.write(MARKER + JSON.stringify(payload) + '\n')
}

function firstError(errors) {
    const message = (errors && errors[0] && errors[0].message) || ''

    return message.replace(/\[[0-9;]*m/g, '').trim() || null
}

class StreamReporter {
    onBegin(_config, suite) {
        emit({ event: 'run:started', total: suite.allTests().length })
    }

    onTestBegin(test) {
        emit({ event: 'test', id: test.id, title: test.title, status: 'pending' })
    }

    onStepBegin(test, _result, step) {
        if (step.category !== 'test.step') return
        emit({ event: 'step', testId: test.id, title: step.title, status: 'pending' })
    }

    onStepEnd(test, _result, step) {
        if (step.category !== 'test.step') return
        emit({
            event: 'step',
            testId: test.id,
            title: step.title,
            status: step.error ? 'failed' : 'success',
            durationMs: step.duration,
            error: step.error ? firstError([step.error]) : null,
        })
    }

    onTestEnd(test, result) {
        const status = result.status === 'passed'
            ? 'success'
            : result.status === 'skipped'
                ? 'skipped'
                : 'failed'

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
