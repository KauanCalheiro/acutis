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

    onTestEnd(test, result) {
        const status = result.status === 'passed'
            ? 'success'
            : result.status === 'skipped'
                ? 'skipped'
                : 'failed'

        emit({
            event: 'test',
            id: test.id,
            title: test.title,
            status,
            durationMs: result.duration,
            error: status === 'failed' ? firstError(result.errors) : null,
        })
    }

    onEnd(result) {
        emit({ event: 'run:finished', status: result.status, passed: result.status === 'passed' })
    }
}

module.exports = StreamReporter
