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
        emit({ event: 'test:started', title: test.title, file: test.location && test.location.file })
    }

    onTestEnd(test, result) {
        const passed = result.status === 'passed'

        emit({
            event: passed ? 'test:passed' : 'test:failed',
            title: test.title,
            status: result.status,
            durationMs: result.duration,
            error: passed ? null : firstError(result.errors),
        })
    }

    onEnd(result) {
        emit({ event: 'run:finished', status: result.status, passed: result.status === 'passed' })
    }
}

module.exports = StreamReporter
