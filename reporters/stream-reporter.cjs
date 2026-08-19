const { readFileSync } = require('node:fs')

const MARKER = '@@ACUTIS_RUN@@'
const ANSI_ESCAPE = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')
// Casa test.step( e setup.step( — o arquivo de autenticação importa `test as setup`.
const STEP_TITLE = /\w+\.step\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g

const AUTH_SETUP_FILE = /auth\.setup\.ts$/
const AUTH_STEP = 'Autenticação'

function fileOf(test) {
  return (test.location && test.location.file) || ''
}

function isAuthSetup(test) {
  return AUTH_SETUP_FILE.test(fileOf(test))
}

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

  return message.replace(ANSI_ESCAPE, '').trim() || null
}

class StreamReporter {
  constructor() {
    this.openSteps = new Map()
    this.lastStep = new Map()
    this.failedSteps = new Set()
    this.authAsDependency = false
  }

  onBegin(_config, suite) {
    const tests = suite.allTests()
    const outros = tests.filter(test => !isAuthSetup(test))

    // O login só é infraestrutura na execução de um cenário: ali ele antecede a timeline de quem
    // se está olhando. Sozinho, ou no meio de vários, ele é um assunto com timeline própria.
    this.authAsDependency = outros.length === 1 && outros.length < tests.length

    const files = [...new Set((this.authAsDependency ? outros : tests).map(test => test.location.file))]
    const steps = declaredStepTitles(files)

    emit({
      event: 'run:started',
      total: tests.length,
      steps: this.authAsDependency ? [AUTH_STEP, ...steps] : steps
    })
  }

  collapsesAuth(test) {
    return this.authAsDependency && isAuthSetup(test)
  }

  onTestBegin(test) {
    emit({
      event: 'test',
      id: test.id,
      title: test.title,
      file: fileOf(test),
      status: 'pending',
      steps: this.collapsesAuth(test) ? [AUTH_STEP] : declaredStepTitles([fileOf(test)])
    })

    if (this.collapsesAuth(test)) {
      emit({ event: 'step', testId: test.id, title: AUTH_STEP, status: 'pending' })
    }
  }

  onStepBegin(test, _result, step) {
    if (step.category !== 'test.step' || this.collapsesAuth(test)) return

    const open = this.openSteps.get(test.id) ?? []
    open.push(step.title)
    this.openSteps.set(test.id, open)

    emit({ event: 'step', testId: test.id, title: step.title, status: 'pending' })
  }

  onStepEnd(test, _result, step) {
    if (step.category !== 'test.step' || this.collapsesAuth(test)) return

    this.closeStep(test.id, step.title)

    if (step.error) {
      this.failedSteps.add(test.id)
    } else {
      this.lastStep.set(test.id, step.title)
    }

    emit({
      event: 'step',
      testId: test.id,
      title: step.title,
      status: step.error ? 'failed' : 'success',
      durationMs: step.duration,
      error: step.error ? firstError([step.error]) : null
    })
  }

  closeStep(testId, title) {
    const open = this.openSteps.get(testId) ?? []
    const index = open.lastIndexOf(title)

    if (index >= 0) open.splice(index, 1)
  }

  /**
     * O timeout do teste não vira erro de passo: o Playwright fecha o passo em que ele bateu sem
     * `step.error` e anexa a mensagem ao teste. Sem reemitir, a timeline fica toda verde debaixo de
     * uma execução vermelha, e ninguém descobre onde parou.
     */
  failOpenSteps(test, error) {
    const open = this.openSteps.get(test.id) ?? []

    for (const title of open) {
      emit({ event: 'step', testId: test.id, title, status: 'failed', durationMs: 0, error })
    }

    this.openSteps.delete(test.id)

    if (open.length > 0 || this.failedSteps.has(test.id)) return

    const last = this.lastStep.get(test.id)

    if (last) emit({ event: 'step', testId: test.id, title: last, status: 'failed', durationMs: 0, error })
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

    const error = status === 'failed' ? firstError(result.errors) : null

    if (this.collapsesAuth(test)) {
      emit({
        event: 'step',
        testId: test.id,
        title: AUTH_STEP,
        status: status === 'success' ? 'success' : 'failed',
        durationMs: result.duration,
        error
      })
    }

    const video = result.attachments.find(a => a.name === 'video')

    emit({
      event: 'test',
      id: test.id,
      title: test.title,
      file: fileOf(test),
      status,
      durationMs: result.duration,
      error,
      // O vídeo do login como dependência não é o do cenário — mostrá-lo faria a interface
      // trocar de vídeo no meio da execução e exibir uma gravação que não é a do teste.
      videoPath: video && !this.collapsesAuth(test) ? video.path : null
    })
  }

  /**
     * Erro global do Playwright (config inválido, "No tests found", import quebrado). Como este é
     * o único reporter do run, o que ele não escrever some — e a execução chega ao usuário como
     * uma falha sem motivo nenhum. Vai para stderr, que o runner recolhe e entrega junto do
     * run:finished.
     */
  onError(error) {
    const message = ((error && (error.message || error.value)) || '').replace(ANSI_ESCAPE, '').trim()

    if (message) {
      process.stderr.write(message + '\n')
    }
  }

  onEnd(result) {
    emit({ event: 'run:finished', status: result.status, passed: result.status === 'passed' })
  }
}

module.exports = StreamReporter
