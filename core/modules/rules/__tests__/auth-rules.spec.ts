// @vitest-environment node
/** As regras que só valem para o arquivo de login. */
import { expect, it } from 'vitest'
import { Playwright } from '../../../common/playwright/playwright.js'
import { specActiveVars, specUrl } from '../../../../test/support/fixtures.js'
import { checkAuth } from '../auth-rules.js'
import { violated, type Violation } from '../violation.js'

/** Um arquivo de login que segue todas as regras. */
function cleanAuthSetup(body = ''): string {
  const inner = body
    || '        await page.context().storageState({ path: process.env.STORAGE_STATE '
    + '|| \'storage-state.json\' })'

  return `import { test as setup, expect } from '@playwright/test'

const base = process.env.URL

setup('autentica no sistema', async ({ page }) => {
    await setup.step('abrir a tela de login', async () => {
        await page.goto(\`\${base}/login\`)
    })

    await setup.step('preencher as credenciais', async () => {
        await page.getByTestId('user').fill(process.env.AUTH_USER)
        await page.getByTestId('pass').fill(process.env.AUTH_PASSWORD)
    })

    await setup.step('confirmar que autenticou', async () => {
        await page.getByTestId('entrar').click()
        await page.waitForURL('**intranet**')
        await expect(page).toHaveURL(/intranet/)
    })

${inner}
})`
}

function check(spec: string): Violation[] {
  return checkAuth(new Playwright(spec), specUrl(), specActiveVars())
}

it('não acha nada de errado num setup que segue todas as regras', () => {
  expect(check(cleanAuthSetup())).toEqual([])
})

it('acusa setup que nunca salva a sessão, deixando todo cenário deslogado', () => {
  const violations = check(cleanAuthSetup('    await page.close()'))

  expect(violated(violations)).toContain('storage-state-ausente')
})

it('acusa setup que importa o helper de teste em vez do de setup', () => {
  const spec = cleanAuthSetup().replace('test as setup', 'test')

  expect(violated(check(spec))).toContain('setup-import')
})

it('acusa setup que salva a sessão e retorna antes de logar', () => {
  const spec = cleanAuthSetup().replace(
    '    await setup.step(\'abrir a tela de login\', async () => {',
    `    if (!process.env.AUTH_USER) {
        await page.context().storageState({ path: 'storage-state.json' })

        return
    }

    await setup.step('abrir a tela de login', async () => {`
  )

  expect(violated(check(spec))).toContain('login-contornado')
})

it('acusa qualquer retorno antecipado no setup, já que significa que o login não aconteceu', () => {
  const spec = cleanAuthSetup().replace(
    '    await setup.step(\'abrir a tela de login\', async () => {',
    '    if (process.env.CI) return\n\n    await setup.step(\'abrir a tela de login\', async () => {'
  )

  expect(violated(check(spec))).toContain('login-contornado')
})

it('acusa retorno em qualquer profundidade, já que um setup que loga não precisa de nenhum', () => {
  const spec = cleanAuthSetup().replace(
    '        await page.goto(`${base}/login`)',
    '        await page.goto(`${base}/login`)\n            if (!process.env.AUTH_USER) return'
  )

  expect(violated(check(spec))).toContain('login-contornado')
})

it('não acha o que acusar num setup que simplesmente roda até o fim', () => {
  expect(violated(check(cleanAuthSetup()))).not.toContain('login-contornado')
})

it('carrega toda regra compartilhada, para o setup ser cobrado na mesma régua', () => {
  const spec = cleanAuthSetup().replace(
    'await page.goto(`${base}/login`)',
    'await page.goto("https://sistema.test/intranet/login")'
  )

  expect(violated(check(spec))).toContain('host-literal')
})
