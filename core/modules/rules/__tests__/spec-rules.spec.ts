// @vitest-environment node
/** As regras a que todo arquivo Playwright gerado é submetido. */
import { describe, expect, it } from 'vitest'
import { environmentVar, type EnvironmentVar } from '../../environment/providers/environment-var.js'
import { Playwright } from '../../../common/playwright/playwright.js'
import { MASK } from '../../recording/recording.js'
import { specActiveVars, specUrl } from '../../../../test/support/fixtures.js'
import { checkSpec } from '../spec-rules.js'
import { violated, type Violation } from '../violation.js'

/** Um arquivo que segue todas as regras, para o teste trocar só o trecho que quer exercitar. */
function cleanSpec(body = ''): string {
  const inner = body || `            await page.goto(\`\${base}/produtos\`)
            await expect(page).toHaveURL(/\\/produtos/)`

  return `import { test, expect } from '@playwright/test'

const base = process.env.URL

test.describe('Consulta de produtos', { tag: ['@read'] }, () => {
    test('lista os produtos', async ({ page }) => {
        await test.step('abrir a listagem', async () => {
${inner}
        })
    })
})`
}

function check(spec: string, extra: EnvironmentVar[] = []): Violation[] {
  return checkSpec(new Playwright(spec), specUrl(), specActiveVars(extra))
}

function firstWhere(violations: Violation[], rule: string): Violation | undefined {
  return violations.find(item => item.rule === rule)
}

it('não acha nada de errado num spec que segue todas as regras', () => {
  expect(check(cleanSpec())).toEqual([])
})

describe('url', () => {
  it('acusa o host da url base escrito literalmente', () => {
    const violations = check(
      cleanSpec('            await page.goto("https://sistema.test/intranet/produtos")')
    )

    expect(violated(violations)).toContain('host-literal')
  })

  it('acusa url montada na mão para outro host, que pula o redirecionamento do sistema', () => {
    const violations = check(cleanSpec(`            const sso = \`sso.\${new URL(base).hostname}\`
            await page.goto(\`https://\${sso}/login\`)`))

    expect(violated(violations)).toContain('url-absoluta')
  })

  it('acusa asserção de url por string exata em vez de padrão', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await expect(page).toHaveURL(\`\${base}/produtos\`)`))

    expect(violated(violations)).toContain('url-exata')
  })

  it('aceita asserção de url feita por expressão regular', () => {
    expect(violated(check(cleanSpec()))).not.toContain('url-exata')
  })

  it('acusa o caminho da url base repetido depois da variável', () => {
    const violations = check(cleanSpec('            await page.goto(`${base}/intranet/produtos`)'))

    expect(violated(violations)).toContain('segmento-repetido')
  })

  it('aceita o caminho da url base dentro de um padrão de espera, onde ele cabe', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.waitForURL('**intranet**')`))

    expect(violated(violations)).not.toContain('segmento-repetido')
  })

  it('aceita padrão de espera que cerca um único segmento dos dois lados', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.waitForURL('**produtos**')`))

    expect(violations).toEqual([])
  })

  it('acusa padrão de espera ancorado no fim, que uma query string quebra', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.waitForURL('**/produtos')`))

    expect(violated(violations)).toContain('url-glob-frouxo')
  })

  it('acusa padrão de espera que exige a barra final', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.waitForURL('**produtos/**')`))

    expect(violated(violations)).toContain('url-glob-frouxo')
  })

  it('acusa padrão de espera que amarra o caminho inteiro em vez do último segmento', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.waitForURL('**pedidos/produtos**')`))

    expect(violated(violations)).toContain('url-glob-frouxo')
  })

  it('acusa regex de url que exige a barra final', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await expect(page).toHaveURL(/\\/produtos\\//)`))

    expect(violated(violations)).toContain('barra-final')
  })

  it('aceita regex de url que casa com e sem a barra final', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await expect(page).toHaveURL(/produtos/)`))

    expect(violated(violations)).not.toContain('barra-final')
  })
})

describe('espera e import', () => {
  it('acusa espera de tempo fixo', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.waitForTimeout(3000)`))

    expect(violated(violations)).toContain('espera-fixa')
  })

  it('acusa import de fora do pacote do playwright', () => {
    const spec = `import { faker } from '@faker-js/faker'\n${cleanSpec()}`

    expect(violated(check(spec))).toContain('import-externo')
  })
})

describe('variáveis de ambiente', () => {
  it('acusa variável que o ambiente nunca declarou', () => {
    const violations = check(cleanSpec().replace('process.env.URL', 'process.env.BASE_URL'))
    const violation = firstWhere(violations, 'env-desconhecida')

    expect(violation).toBeDefined()
    expect(violation!.message).toContain('BASE_URL')
    expect(violation!.fixable).toBe(true)
  })

  it('permite as chaves que pertencem ao acutis mesmo sem o ambiente declará-las', () => {
    const spec = cleanSpec().replace('process.env.URL', 'process.env.STORAGE_STATE')

    expect(violated(check(spec))).not.toContain('env-desconhecida')
  })

  it('acusa chave declarada sem valor, e deixa para o usuário preencher', () => {
    const spec = cleanSpec().replace('process.env.URL', 'process.env.BASE_AUTH')
    const violations = check(spec, [environmentVar('BASE_AUTH', '')])
    const violation = firstWhere(violations, 'env-sem-valor')

    expect(violation).toBeDefined()
    expect(violation!.message).toContain('BASE_AUTH')
    expect(violation!.fixable).toBe(false)
  })

  it('acusa valor não secreto do ambiente escrito literalmente em vez de por process.env', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.getByTestId('user').fill('usuario-de-teste')`))

    const violation = firstWhere(violations, 'valor-literal')

    expect(violation).toBeDefined()
    expect(violation!.message).toContain('AUTH_USER')
  })

  /** O valor secreto nunca chega às regras, então não há literal a acusar. */
  it('nunca reporta um valor secreto', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.getByTestId('pass').fill('topsecret123')`))

    expect(violated(violations)).not.toContain('valor-literal')
  })

  it('ignora valor de ambiente curto, que casaria em qualquer lugar por acaso', () => {
    const violations = check(cleanSpec(), [environmentVar('PAGINA', 'pro')])

    expect(violated(violations)).not.toContain('valor-literal')
  })
})

describe('await e comentários', () => {
  it('acusa passo sem await, que rodaria em paralelo e quebraria', () => {
    const spec = cleanSpec().replace('await test.step(\'abrir a listagem\'', 'test.step(\'abrir a listagem\'')

    expect(violated(check(spec))).toContain('step-sem-await')
  })

  it('aceita passo que foi aguardado', () => {
    expect(violated(check(cleanSpec()))).not.toContain('step-sem-await')
  })

  it('acusa navegação sem await', () => {
    const violations = check(cleanSpec('            page.goto(`${base}/produtos`)'))

    expect(violated(violations)).toContain('acao-sem-await')
  })

  it('acusa comentário de linha deixado no spec gerado', () => {
    const violations = check(cleanSpec(`            // abre a listagem de produtos
            await page.goto(\`\${base}/produtos\`)`))

    expect(violated(violations)).toContain('comentario-inline')
  })

  it('acusa comentário de bloco também', () => {
    const violations = check(cleanSpec(`            /* abre a listagem */
            await page.goto(\`\${base}/produtos\`)`))

    expect(violated(violations)).toContain('comentario-inline')
  })

  it('nunca confunde uma url dentro de string com comentário', () => {
    const violations = check(cleanSpec(`            await page.goto(\`\${base}/produtos\`)
            await page.waitForURL('**/produtos')`))

    expect(violated(violations)).not.toContain('comentario-inline')
  })
})

describe('resíduo da gravação', () => {
  it('acusa a máscara copiada direto para o spec, que digitaria bolinhas no campo', () => {
    const violations = check(
      cleanSpec(`            await page.getByTestId('pass').fill('${MASK}')`)
    )

    expect(violated(violations)).toContain('mascara-no-spec')
  })

  it('acusa marcador de ambiente copiado em vez de resolvido para process.env', () => {
    const violations = check(
      cleanSpec('            await page.getByTestId(\'user\').fill(\'{{AUTH_USER}}\')')
    )

    expect(violated(violations)).toContain('marcador-no-spec')
  })
})
