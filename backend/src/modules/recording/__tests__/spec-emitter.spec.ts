// @vitest-environment node
/** A especificação do que o gerador de spec faz. */
import { describe, expect, it } from 'vitest'
import { Playwright } from '../../../common/playwright/playwright.js'
import { checkAuth } from '../../rules/auth-rules.js'
import { checkSpec } from '../../rules/spec-rules.js'
import { violated } from '../../rules/violation.js'
import { Recording } from '../recording.js'
import { SpecEmitter } from '../spec-emitter.js'
import type { EnvironmentVar } from '../../environment/providers/environment-var.js'
import type { RecordedEvent } from '../events.js'
import { emitEvent, selectors, specActiveVars, specUrl, SPEC_BASE_URL } from '../../../../test/support/fixtures.js'

const EMIT_BASE = SPEC_BASE_URL

function emit(events: RecordedEvent[], extraEnv: EnvironmentVar[] = []): string {
    return new SpecEmitter(Recording.make(events), specUrl(), specActiveVars(extraEnv))
        .spec('Cadastro de produto', 'cria um produto')
        .value
}

describe('abertura da gravação', () => {
    it('abre com um goto montado a partir da variável de URL base', () => {
        const spec = emit([emitEvent('navigate', { url: `${EMIT_BASE}/produtos` })])

        expect(spec).toContain('await page.goto(`${base}/produtos`)')
        expect(spec).toContain('const base = process.env.URL')
    })

    it('nomeia o describe e o test a partir do título e do cenário informados', () => {
        const spec = emit([emitEvent('navigate')])

        expect(spec).toContain("test.describe('Cadastro de produto'")
        expect(spec).toContain("test('cria um produto'")
    })
})

describe('navegação', () => {
    it('transforma a navegação seguinte à primeira em espera pelo segmento da url', () => {
        const spec = emit([
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` }),
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos/novo` })
        ])

        expect(spec.match(/page\.goto/g) ?? []).toHaveLength(1)
        expect(spec).toContain("await page.waitForURL('**novo**')")
    })

    it('ignora a navegação que caiu na url que a página já estava mostrando', () => {
        const spec = emit([
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` }),
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` })
        ])

        expect(spec).not.toContain('waitForURL')
    })

    it('espera por um segmento que carrega extensão de arquivo', () => {
        const spec = emit([
            emitEvent('navigate', { url: `${EMIT_BASE}/index.html` }),
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos.html?busca=cadeira` })
        ])

        expect(spec).toContain("await page.waitForURL('**produtos.html**')")
    })

    /** Esperar por um segmento que a base já tem é esperar por nada: passa antes de navegar. */
    it('nunca espera por um segmento que a url base já carrega', () => {
        const spec = emit([
            emitEvent('navigate', { url: `${EMIT_BASE}/login` }),
            emitEvent('navigate', { url: `${EMIT_BASE}/` })
        ])

        expect(spec).not.toContain('waitForURL')
        expect(spec).toContain('await page.goto(`${base}/login`)')
    })

    it('mantém a conta da tela em que a página está mesmo com um iframe navegando no meio', () => {
        const spec = emit([
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` }),
            emitEvent('navigate', { url: 'https://www.facebook.com/tr/' }),
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` })
        ])

        expect(spec).not.toContain('waitForURL')
    })

    /** Navegação de outro host é o pixel e o iframe do captcha navegando sozinhos. */
    it('ignora navegação de outro host', () => {
        const spec = emit([
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` }),
            emitEvent('navigate', { url: 'https://www.facebook.com/tr/' }),
            emitEvent('navigate', { url: 'https://www.google.com/recaptcha/api2/bframe?hl=pt-BR' }),
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos/novo` })
        ])

        expect(spec).not.toContain('**tr**')
        expect(spec).not.toContain('bframe')
        expect(spec).toContain("await page.waitForURL('**novo**')")
    })

    it('espera pelo segmento anterior ao identificador quando a url termina em um', () => {
        const spec = emit([
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` }),
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos/1042` })
        ])

        expect(spec).toContain("await page.waitForURL('**produtos**')")
    })
})

describe('escolha do seletor', () => {
    it('espera o elemento estar visível antes de clicar nele', () => {
        const spec = emit([
            emitEvent('click', { selectors: selectors({ dataTestId: 'salvar' }), label: 'Salvar' })
        ])

        expect(spec).toContain("page.getByTestId('salvar')")
        expect(spec).toContain('await expect(alvo).toBeVisible()')
        expect(spec).toContain('await alvo.click()')
    })

    it('escolhe o css estável quando o elemento não tem test id', () => {
        const spec = emit([emitEvent('click', { selectors: selectors({ cssStable: '#salvar' }) })])

        expect(spec).toContain("page.locator('#salvar')")
    })

    it('prefere o texto que o gravador validou como único ao css gerado', () => {
        const spec = emit([
            emitEvent('click', {
                selectors: selectors({ text: '/caminho/intranet', finder: '.text-sm:nth-child(2)' })
            })
        ])

        expect(spec).toContain("page.getByText('/caminho/intranet', { exact: true })")
        expect(spec).not.toContain('.text-sm')
    })

    it('cai no seletor único gerado quando nada melhor foi capturado', () => {
        const spec = emit([
            emitEvent('click', { selectors: selectors({ finder: 'main > .card:nth-child(2) button' }) })
        ])

        expect(spec).toContain("page.locator('main > .card:nth-child(2) button')")
    })

    it('pula o evento cujo elemento não teve seletor nenhum resolvido', () => {
        const spec = emit([emitEvent('navigate'), emitEvent('click', { selectors: selectors() })])

        expect(spec).not.toContain('.click()')
    })
})

describe('preenchimento', () => {
    it('preenche um campo de texto com o valor gravado', () => {
        const spec = emit([
            emitEvent('fill', {
                selectors: selectors({ dataTestId: 'nome' }),
                label: 'Nome',
                value: 'Cadeira de escritório',
                tagName: 'input',
                inputType: 'text'
            })
        ])

        expect(spec).toContain("await campo.fill('Cadeira de escritório')")
        expect(spec).toContain('await expect(campo).toBeVisible()')
    })

    it('seleciona a opção gravada quando o elemento é um select', () => {
        const spec = emit([
            emitEvent('fill', {
                selectors: selectors({ cssStable: '#estado' }),
                value: 'RS',
                tagName: 'select'
            })
        ])

        expect(spec).toContain("await campo.selectOption('RS')")
    })

    it('marca a caixa em vez de digitar nela quando o elemento é um checkbox', () => {
        const spec = emit([
            emitEvent('fill', {
                selectors: selectors({ cssStable: '#ativo' }),
                value: 'on',
                tagName: 'input',
                inputType: 'checkbox',
                checked: true
            })
        ])

        expect(spec).toContain('await campo.check()')
        expect(spec).not.toContain('.fill(')
    })

    it('desmarca a caixa que a gravação deixou desmarcada', () => {
        const spec = emit([
            emitEvent('fill', {
                selectors: selectors({ cssStable: '#ativo' }),
                value: 'on',
                tagName: 'input',
                inputType: 'checkbox',
                checked: false
            })
        ])

        expect(spec).toContain('await campo.uncheck()')
    })

    it('descarta a mudança que o próprio clique no checkbox produziu', () => {
        const spec = emit([
            emitEvent('click', {
                selectors: selectors({ cssStable: '#presente' }),
                label: 'Embrulhar'
            }),
            emitEvent('fill', {
                selectors: selectors({ cssStable: '#presente' }),
                label: 'Embrulhar',
                value: 'on',
                tagName: 'input',
                inputType: 'checkbox',
                checked: true
            })
        ])

        expect(spec).toContain('await alvo.click()')
        expect(spec).not.toContain('.check()')
    })

    it('lê da variável o valor que o ambiente já guarda, em vez de escrevê-lo', () => {
        const spec = emit([
            emitEvent('fill', {
                selectors: selectors({ dataTestId: 'usuario' }),
                value: 'usuario-de-teste',
                tagName: 'input',
                inputType: 'text'
            })
        ])

        expect(spec).toContain('await campo.fill(process.env.AUTH_USER)')
        expect(spec).not.toContain('usuario-de-teste')
    })

    it('batiza a variável com o rótulo do campo para valor que o gravador marcou como sensível', () => {
        const events = [
            emitEvent('fill', {
                selectors: selectors({ dataTestId: 'senha' }),
                label: 'Senha de acesso',
                value: 'nao-sai-daqui',
                sensitive: true,
                tagName: 'input',
                inputType: 'password'
            })
        ]

        const emitter = new SpecEmitter(Recording.make(events), specUrl(), specActiveVars())

        expect(emitter.spec('t', 'c').value).toContain('await campo.fill(process.env.SENHA_DE_ACESSO)')
        expect(emitter.envVars()).toEqual(['SENHA_DE_ACESSO'])
    })

    it('escapa um valor que carrega a aspa que o arquivo gerado usa', () => {
        const spec = emit([
            emitEvent('fill', {
                selectors: selectors({ dataTestId: 'nome' }),
                value: "Cadeira d'água",
                tagName: 'input',
                inputType: 'text'
            })
        ])

        expect(spec).toContain("await campo.fill('Cadeira d\\'água')")
    })
})

describe('envio do formulário', () => {
    it('descarta o submit que o clique no botão já disparou', () => {
        const spec = emit([
            emitEvent('click', { selectors: selectors({ dataTestId: 'salvar' }), label: 'Salvar' }),
            emitEvent('submit', { selectors: selectors({ cssStable: '#form' }) })
        ])

        expect(spec.match(/await alvo\.click\(\)/g) ?? []).toHaveLength(1)
        expect(spec).not.toContain('Enter')
    })

    it('aperta enter no último campo preenchido quando o envio veio sem clique', () => {
        const spec = emit([
            emitEvent('fill', {
                selectors: selectors({ dataTestId: 'busca' }),
                value: 'cadeira',
                tagName: 'input',
                inputType: 'text'
            }),
            emitEvent('submit', { selectors: selectors({ cssStable: '#form' }) })
        ])

        expect(spec).toContain("await page.getByTestId('busca').press('Enter')")
    })
})

describe('títulos dos passos', () => {
    it('nomeia o passo pelo placeholder quando o campo não tem rótulo', () => {
        const spec = emit([
            emitEvent('fill', {
                selectors: selectors({ dataTestId: 'busca', placeholder: 'Buscar projeto...' }),
                value: 'intranet',
                tagName: 'input',
                inputType: 'text'
            })
        ])

        expect(spec).toContain('await test.step(\'Preenche "Buscar projeto..."\'')
    })

    it('nomeia o passo sem artigo solto quando o elemento não descreve nada', () => {
        const spec = emit([emitEvent('click', { selectors: selectors({ cssStable: '#voltar' }) })])

        expect(spec).toContain("await test.step('Clica no elemento'")
    })
})

describe('o arquivo gerado passa pelas próprias regras', () => {
    it('não quebra nenhuma regra a que o cenário gerado é submetido', () => {
        const spec = emit([
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` }),
            emitEvent('click', {
                selectors: selectors({ dataTestId: 'novo' }),
                label: 'Novo produto'
            }),
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos/novo` }),
            emitEvent('fill', {
                url: `${EMIT_BASE}/produtos/novo`,
                selectors: selectors({ cssStable: '#nome' }),
                label: 'Nome',
                value: 'Cadeira',
                tagName: 'input',
                inputType: 'text'
            }),
            emitEvent('fill', {
                url: `${EMIT_BASE}/produtos/novo`,
                selectors: selectors({ dataTestId: 'senha' }),
                label: 'Senha',
                value: 'topsecret123',
                sensitive: true,
                tagName: 'input',
                inputType: 'password'
            }),
            emitEvent('click', {
                url: `${EMIT_BASE}/produtos/novo`,
                selectors: selectors({ dataTestId: 'salvar' }),
                label: 'Salvar'
            }),
            emitEvent('submit', {
                url: `${EMIT_BASE}/produtos/novo`,
                selectors: selectors({ cssStable: '#form' })
            }),
            emitEvent('navigate', { url: `${EMIT_BASE}/produtos` }),
            emitEvent('assert', {
                selectors: selectors({ dataTestId: 'flash' }),
                assert: { assertType: 'contains', expectedValue: 'Produto criado' }
            })
        ])

        expect(violated(checkSpec(new Playwright(spec), specUrl(), specActiveVars()))).toEqual([])
    })

    it('não quebra nenhuma regra a que o arquivo de login é submetido', () => {
        const setup = emitAuth(login([emitEvent('navigate', { url: `${EMIT_BASE}/painel` })]))

        expect(violated(checkAuth(new Playwright(setup), specUrl(), specActiveVars()))).toEqual([])
    })
})

function emitAuth(events: RecordedEvent[]): string {
    return new SpecEmitter(Recording.make(events), specUrl(), specActiveVars()).authSetup().value
}

/** A gravação de um login: navega, preenche usuário e senha, clica em entrar. */
function login(extra: RecordedEvent[] = []): RecordedEvent[] {
    return [
        emitEvent('navigate', { url: `${EMIT_BASE}/login` }),
        emitEvent('fill', {
            url: `${EMIT_BASE}/login`,
            selectors: selectors({ cssStable: '#usuario' }),
            label: 'Usuário',
            value: 'kauan',
            tagName: 'input',
            inputType: 'text'
        }),
        emitEvent('fill', {
            url: `${EMIT_BASE}/login`,
            selectors: selectors({ cssStable: '#senha' }),
            label: 'Senha',
            value: 'topsecret123',
            tagName: 'input',
            inputType: 'password'
        }),
        emitEvent('click', {
            url: `${EMIT_BASE}/login`,
            selectors: selectors({ dataTestId: 'entrar' }),
            label: 'Entrar'
        }),
        ...extra
    ]
}

describe('arquivo de login', () => {
    it('escreve o arquivo contra o helper de setup, não o de teste', () => {
        const setup = emitAuth(login())

        expect(setup).toContain("import { test as setup, expect } from '@playwright/test'")
        expect(setup).toContain("setup('autenticação'")
        expect(setup).toContain('await setup.step(')
        expect(setup).not.toContain('test.step(')
    })

    it('lê as credenciais das variáveis de ambiente em vez de escrevê-las', () => {
        const setup = emitAuth(login())

        expect(setup).toContain('await campo.fill(process.env.AUTH_USER)')
        expect(setup).toContain('await campo.fill(process.env.AUTH_PASSWORD)')
        expect(setup).not.toContain('topsecret123')
        expect(setup).not.toContain('kauan')
    })

    it('fecha o login salvando a sessão onde o ambiente manda', () => {
        const setup = emitAuth(login())

        expect(setup).toContain(
            "await page.context().storageState({ path: process.env.STORAGE_STATE || 'storage-state.json' })"
        )
        expect(setup.indexOf('storageState(')).toBeGreaterThan(setup.indexOf('AUTH_PASSWORD'))
    })

    it('deixa a página assentar antes de fotografar a sessão, senão salva uma pela metade', () => {
        const setup = emitAuth(login())

        expect(setup).toContain("await page.waitForLoadState('load')")
        expect(setup.indexOf('storageState(')).toBeGreaterThan(setup.indexOf('waitForLoadState'))
    })

    it('confirma o login pela tela em que a gravação caiu', () => {
        const setup = emitAuth(login([emitEvent('navigate', { url: `${EMIT_BASE}/painel` })]))

        expect(setup).toContain("await page.waitForURL('**painel**')")
        expect(setup).toContain('await expect(page).toHaveURL(/painel/,')
    })

    it('confirma o login pelo sumiço do campo de senha quando a gravação nunca navegou', () => {
        const setup = emitAuth(login())

        expect(setup).toContain("await expect(page.locator('#senha')).toBeHidden(")
        expect(setup).not.toContain('toHaveURL')
    })

    it('confirma pelo campo de senha quando a url de chegada nada diz que a base já não diga', () => {
        const setup = emitAuth(login([emitEvent('navigate', { url: `${EMIT_BASE}/` })]))

        expect(setup).toContain("await expect(page.locator('#senha')).toBeHidden(")
        expect(setup).not.toContain('toHaveURL')
    })

    it('dá à confirmação do login um prazo que cabe uma ida ao servidor', () => {
        const setup = emitAuth(login([emitEvent('navigate', { url: `${EMIT_BASE}/painel` })]))

        expect(setup).toContain('await expect(page).toHaveURL(/painel/, { timeout: 15000 })')
    })

    /** Um early return salvaria uma sessão que nunca logou. */
    it('nunca escreve um retorno antecipado', () => {
        expect(emitAuth(login())).not.toContain('return')
    })
})

describe('interações e asserções', () => {
    it('passa o mouse no elemento gravado em modo hover', () => {
        const spec = emit([
            emitEvent('hover', { selectors: selectors({ dataTestId: 'menu' }), label: 'Menu' })
        ])

        expect(spec).toContain('await alvo.hover()')
    })

    it('escreve cada tipo de asserção com o matcher que lhe cabe', () => {
        const spec = emit([
            emitEvent('assert', {
                selectors: selectors({ dataTestId: 'titulo' }),
                assert: { assertType: 'text', expectedValue: 'Produtos' }
            }),
            emitEvent('assert', {
                selectors: selectors({ dataTestId: 'aviso' }),
                assert: { assertType: 'hidden', expectedValue: null }
            }),
            emitEvent('assert', {
                selectors: selectors({ dataTestId: 'total' }),
                assert: { assertType: 'contains', expectedValue: '3 itens' }
            })
        ])

        expect(spec).toContain("await expect(alvo).toHaveText('Produtos')")
        expect(spec).toContain('await expect(alvo).toBeHidden()')
        expect(spec).toContain("await expect(alvo).toContainText('3 itens')")
    })

    it('afirma a url por padrão do segmento, nunca pelo endereço inteiro', () => {
        const spec = emit([
            emitEvent('assert', {
                url: `${EMIT_BASE}/produtos/novo`,
                selectors: selectors({ dataTestId: 'x' }),
                assert: { assertType: 'url', expectedValue: `${EMIT_BASE}/produtos/novo` }
            })
        ])

        expect(spec).toContain('await expect(page).toHaveURL(/novo/)')
    })

    it('dá prazo maior à espera onde a gravação mostra que o usuário aguardou a página', () => {
        const spec = emit([
            emitEvent('navigate', { timestamp: 1000 }),
            emitEvent('click', { timestamp: 9000, selectors: selectors({ dataTestId: 'salvar' }) })
        ])

        expect(spec).toContain('await expect(alvo).toBeVisible({ timeout: 15000 })')
    })
})
