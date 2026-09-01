/**
 * Escreve o arquivo Playwright direto dos eventos gravados, sem passar por modelo. Cada evento vira
 * um passo, e o que a gravação não sustenta não é escrito.
 */
import { EnvKey } from '../environment/providers/env-key.js'
import type { ActiveVars } from '../../common/playwright/active-vars.js'
import { Playwright } from '../../common/playwright/playwright.js'
import { pathOf, type Url } from '../../common/playwright/url.js'
import type { RecordedEvent, Selectors } from './events.js'
import type { Recording } from './recording.js'
import { describeElement, SENSITIVE_PREFIX } from './recording.js'

/** A partir de quanto tempo entre dois eventos a pausa conta como espera pela página. */
const NOTICEABLE_PAUSE_MS = 2000

const SLOW_TIMEOUT = 15000

interface Step {
  title: string
  lines: string[]
}

/** O texto em maiúsculas, sem acento e sem pontuação, junto por `_`. */
function slugUpper(source: string): string {
  return source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export class SpecEmitter {
  private cachedNames: Record<string, string> | null = null

  constructor(
    private readonly recording: Recording,
    private readonly base: Url,
    private readonly environments: ActiveVars
  ) {}

  spec(title: string, scenario: string): Playwright {
    const lines = [
      'import { test, expect } from \'@playwright/test\'',
      '',
      `const base = process.env.${EnvKey.URL}`,
      '',
      `test.describe(${this.literal(title)}, () => {`,
      `    test(${this.literal(scenario)}, async ({ page }) => {`,
      ...this.render(this.steps(this.recording.redacted(this.environments)), 'test', '        '),
      '    })',
      '})'
    ]

    return new Playwright(`${lines.join('\n')}\n`)
  }

  /** O arquivo de login, que confirma a entrada e salva a sessão no arquivo do playwright.config. */
  authSetup(): Playwright {
    const events = this.recording.withoutPasswords()

    const steps = [
      ...this.steps(events),
      ...[this.confirmation(events), this.session()].filter((step): step is Step => step !== null)
    ]

    const lines = [
      'import { test as setup, expect } from \'@playwright/test\'',
      '',
      `const base = process.env.${EnvKey.URL}`,
      '',
      'setup(\'autenticação\', async ({ page }) => {',
      ...this.render(steps, 'setup', '    '),
      '})'
    ]

    return new Playwright(`${lines.join('\n')}\n`)
  }

  /** Os nomes de variável dos valores sensíveis, na ordem do marcador. */
  envVars(): string[] {
    return Object.values(this.names())
  }

  /** O passo que prova que o login aconteceu: a tela em que a gravação caiu, ou o sumiço da senha. */
  private confirmation(events: RecordedEvent[]): Step | null {
    const segment = this.segment(this.recording.landingUrl() ?? '')
    const deadline = `{ timeout: ${SLOW_TIMEOUT} }`

    if (segment !== null) {
      return {
        title: `Confere que o login levou para ${this.quoted(segment)}`,
        lines: [`await expect(page).toHaveURL(/${segment.replace(/\./g, '\\.')}/, ${deadline})`]
      }
    }

    for (const event of events) {
      if (event.inputType !== 'password') continue

      const locator = this.locator(event)

      if (locator === null) continue

      return {
        title: 'Confere que o campo de senha saiu da tela',
        lines: [`await expect(${locator}).toBeHidden(${deadline})`]
      }
    }

    return null
  }

  private session(): Step {
    return {
      title: 'Salva a sessão autenticada',
      lines: [
        'await page.waitForLoadState(\'load\')',
        `await page.context().storageState({ path: process.env.${EnvKey.STORAGE_STATE} `
        + '|| \'storage-state.json\' })'
      ]
    }
  }

  private render(steps: Step[], helper: string, pad: string): string[] {
    const lines: string[] = []

    steps.forEach((step, position) => {
      if (position > 0) lines.push('')

      lines.push(`${pad}await ${helper}.step(${this.literal(step.title)}, async () => {`)

      for (const line of step.lines) {
        lines.push(`${pad}    ${line}`)
      }

      lines.push(`${pad}})`)
    })

    return lines
  }

  private steps(events: RecordedEvent[]): Step[] {
    const steps: Step[] = []
    let navigated = false
    let currentUrl: string | null = null
    let lastField: string | null = null
    let lastClick: string | null = null
    let previousType: string | null = null
    let previousAt: number | null = null

    for (const event of events) {
      const type = event.type ?? ''
      const at = event.timestamp ?? 0
      const slow = previousAt !== null && at - previousAt >= NOTICEABLE_PAUSE_MS
      previousAt = at

      let step: Step | null = null

      if (type === 'navigate') {
        step = this.navigation(event, navigated, currentUrl)
      } else if (type === 'click' || type === 'hover') {
        step = this.interaction(event, type, slow)
      } else if (type === 'fill') {
        const entry = this.entry(event, slow, lastClick)
        step = entry.step
        if (entry.field !== null) lastField = entry.field
      } else if (type === 'submit') {
        step = this.submission(previousType, lastField)
      } else if (type === 'assert') {
        step = this.assertion(event, slow)
      }

      if (type === 'navigate' && this.onBase(event.url ?? '')) {
        navigated = true
        currentUrl = event.url ?? ''
      }

      if (type === 'click') {
        lastClick = this.locator(event)
      }

      if (step !== null) {
        steps.push(step)
        previousType = type
      }
    }

    return steps
  }

  private navigation(event: RecordedEvent, navigated: boolean, currentUrl: string | null): Step | null {
    const url = event.url ?? ''

    if (navigated && !this.onBase(url)) return null

    if (!navigated) {
      const path = this.relativePath(url) ?? ''

      return {
        title: `Navega para ${path === '' ? 'a página inicial' : this.quoted(path)}`,
        lines: ['await page.goto(`${base}' + path + '`)']
      }
    }

    const segment = url === currentUrl ? null : this.segment(url)

    if (segment === null) return null

    return {
      title: `Aguarda a tela ${this.quoted(segment)}`,
      lines: [`await page.waitForURL('**${segment}**')`]
    }
  }

  private interaction(event: RecordedEvent, type: string, slow: boolean): Step | null {
    const locator = this.locator(event)

    if (locator === null) return null

    const verb = type === 'hover' ? 'hover' : 'click'
    const prefix = type === 'hover' ? 'Passa o mouse' : 'Clica'
    const what = describeElement(event)

    return {
      title: what === null ? `${prefix} no elemento` : `${prefix} em ${this.quoted(what)}`,
      lines: [
        `const alvo = ${locator}`,
        `await expect(alvo).toBeVisible(${this.timeout(slow)})`,
        `await alvo.${verb}()`
      ]
    }
  }

  private entry(
    event: RecordedEvent,
    slow: boolean,
    lastClick: string | null
  ): { step: Step | null, field: string | null } {
    const locator = this.locator(event)

    if (locator === null) return { step: null, field: null }

    const toggle = event.inputType === 'checkbox' || event.inputType === 'radio'

    if (toggle && locator === lastClick) return { step: null, field: null }

    const value = event.value ?? ''
    const checked = event.checked ?? true

    const action = event.tagName === 'select'
      ? `selectOption(${this.value(value)})`
      : toggle
        ? (checked ? 'check()' : 'uncheck()')
        : `fill(${this.value(value)})`

    const what = describeElement(event)

    return {
      field: locator,
      step: {
        title: `Preenche ${what === null ? 'o campo' : this.quoted(what)}`,
        lines: [
          `const campo = ${locator}`,
          `await expect(campo).toBeVisible(${this.timeout(slow)})`,
          `await campo.${action}`
        ]
      }
    }
  }

  /** O passo do Enter no último campo, quando não houve clique de envio. */
  private submission(previousType: string | null, lastField: string | null): Step | null {
    if (previousType === 'click' || lastField === null) return null

    return {
      title: 'Envia o formulário',
      lines: [`await ${lastField}.press('Enter')`]
    }
  }

  /** A tela afirmada pelo endereço: pelo segmento próprio dela, ou pelo caminho inteiro. */
  private urlAssertion(target: string): Step | null {
    const segment = this.segment(target)

    if (segment !== null) {
      return {
        title: `Confere que a tela é ${this.quoted(segment)}`,
        lines: [`await expect(page).toHaveURL(/${segment.replace(/\./g, '\\.')}/)`]
      }
    }

    const path = pathOf(target).replace(/\/+$/, '')

    if (path === '') return null

    const pattern = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\/')
    const relative = this.relativePath(target)

    return {
      title: `Confere que a tela é ${relative === '' || relative === null ? 'a página inicial' : this.quoted(relative)}`,
      lines: [`await expect(page).toHaveURL(/${pattern}\\/?$/)`]
    }
  }

  private assertion(event: RecordedEvent, slow: boolean): Step | null {
    const assert = event.assert ?? {}
    const expected = assert.expectedValue ?? null
    const type = assert.assertType ?? 'visible'

    if (type === 'url') return this.urlAssertion(expected ?? event.url ?? '')

    const locator = this.locator(event)

    if (locator === null) return null

    const matchers: Record<string, string> = {
      hidden: 'toBeHidden()',
      text: `toHaveText(${this.value(expected ?? '')})`,
      contains: `toContainText(${this.value(expected ?? '')})`,
      value: `toHaveValue(${this.value(expected ?? '')})`,
      checked: 'toBeChecked()',
      disabled: 'toBeDisabled()'
    }

    const matcher = matchers[type] ?? `toBeVisible(${this.timeout(slow)})`
    const what = describeElement(event)

    return {
      title: `Confere ${what === null ? 'o elemento' : this.quoted(what)}`,
      lines: [`const alvo = ${locator}`, `await expect(alvo).${matcher}`]
    }
  }

  private locator(event: RecordedEvent): string | null {
    const selectors: Partial<Selectors> | null | undefined = event.selectors

    if (!selectors) return null

    if (selectors.dataTestId) {
      const visible = selectors.hiddenTwins ? '.filter({ visible: true })' : ''

      return `page.getByTestId(${this.literal(selectors.dataTestId)})${visible}`
    }
    if (selectors.dataCy) return `page.locator(${this.literal(`[data-cy="${selectors.dataCy}"]`)})`
    if (selectors.ariaLabel) return `page.locator(${this.literal(`[aria-label="${selectors.ariaLabel}"]`)})`
    if (selectors.placeholder) return `page.getByPlaceholder(${this.literal(selectors.placeholder)})`
    if (selectors.cssStable) return `page.locator(${this.literal(selectors.cssStable)})`
    if (selectors.id) return `page.locator(${this.literal(`[id="${selectors.id}"]`)})`
    if (selectors.text) return `page.getByText(${this.literal(selectors.text)}, { exact: true })`
    if (selectors.finder) return `page.locator(${this.literal(selectors.finder)})`
    if (selectors.xpath) return `page.locator(${this.literal(`xpath=${selectors.xpath}`)})`

    return null
  }

  private timeout(slow: boolean): string {
    return slow ? `{ timeout: ${SLOW_TIMEOUT} }` : ''
  }

  /** O valor escrito no arquivo: variável quando o ambiente já o guarda, literal quando não. */
  private value(value: string): string {
    const marker = value.match(/^\{\{([A-Z0-9_]+)\}\}$/)

    if (marker) {
      const key = marker[1]!

      return `process.env.${this.names()[key] ?? key}`
    }

    const key = this.environments.keyOf(value)

    return key === null ? this.literal(value) : `process.env.${key}`
  }

  /** Marcador de valor sensível → nome de variável, tirado do label do campo. */
  private names(): Record<string, string> {
    if (this.cachedNames !== null) return this.cachedNames

    const names: Record<string, string> = {}

    for (const event of this.recording.redacted(this.environments)) {
      const marker = (event.value ?? '').match(
        new RegExp(`^\\{\\{(${SENSITIVE_PREFIX}\\d+)\\}\\}$`)
      )

      if (!marker) continue

      names[marker[1]!] = this.name(event, marker[1]!, names)
    }

    // Ordem natural: SENSIVEL_2 vem antes de SENSIVEL_10.
    const ordered: Record<string, string> = {}
    for (const key of Object.keys(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
      ordered[key] = names[key]!
    }

    this.cachedNames = ordered

    return ordered
  }

  private name(event: RecordedEvent, fallback: string, taken: Record<string, string>): string {
    const selectors = event.selectors ?? null
    const source = event.label ?? selectors?.name ?? selectors?.placeholder ?? ''
    const candidate = slugUpper(source)

    if (!/^[A-Z][A-Z0-9_]*$/.test(candidate)) return fallback

    let name = candidate
    let suffix = 1

    while (Object.values(taken).includes(name) || this.environments.has(name)) {
      suffix++
      name = `${candidate}_${suffix}`
    }

    return name
  }

  /** Se a URL é do mesmo host da URL base. */
  private onBase(url: string): boolean {
    return hostOf(url) === this.base.host()
  }

  /** O caminho depois da URL base; null quando a navegação saiu para outro host. */
  private relativePath(url: string): string | null {
    if (hostOf(url) !== this.base.host()) return null

    let path = pathOf(url).replace(/\/+$/, '')
    const basePath = this.base.path()

    if (basePath !== '' && path.startsWith(basePath)) {
      path = path.slice(basePath.length)
    }

    const query = (() => {
      try {
        return new URL(url).search.replace(/^\?/, '')
      } catch {
        return ''
      }
    })()

    return path + (query === '' ? '' : `?${query}`)
  }

  /**
     * O último segmento do caminho que serve para reconhecer a tela, fora identificador e fora o
     * que a URL base já carrega.
     */
  private segment(url: string): string | null {
    const path = pathOf(url).replace(/^\/+|\/+$/g, '')
    const fromBase = this.base.path().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)

    const named = path
      .split('/')
      .filter(part => /^[\w.-]+$/u.test(part) && !this.isIdentifier(part) && !fromBase.includes(part))

    return named.length === 0 ? null : named[named.length - 1]!
  }

  private isIdentifier(segment: string): boolean {
    return /^\d+$/.test(segment) || /^[0-9a-f][0-9a-f-]{15,}$/i.test(segment)
  }

  private literal(value: string): string {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`
  }

  /** O alvo entre aspas, como ele aparece no título do passo. */
  private quoted(what: string): string {
    return `"${what}"`
  }
}
