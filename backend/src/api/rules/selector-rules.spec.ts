// @vitest-environment node
/**
 * A convenção de `data-testid` do projeto, cobrada como regra. Portado de
 * `backend-laravel/tests/Unit/Ai/Rules/SelectorRulesTest.php`.
 */
import { expect, it } from 'vitest'
import { checkSelectors, type SelectorSuggestion } from './selector-rules.js'
import { violated } from './violation.js'

function suggestion(testId: string): SelectorSuggestion {
    return {
        event: 'click em Entrar',
        currentSelector: '.btn-primary',
        suggestedTestId: testId,
        reason: 'classe CSS pode mudar com estilização'
    }
}

it('não acha nada de errado num testid no padrão recurso-ação', () => {
    expect(checkSelectors([suggestion('login-entrar')])).toEqual([])
})

it('aceita um testid com mais de dois segmentos', () => {
    expect(checkSelectors([suggestion('carrinho-remover-item')])).toEqual([])
})

it('acusa testid escrito em camel case', () => {
    expect(violated(checkSelectors([suggestion('loginEntrar')]))).toContain('testid-kebab')
})

it('acusa testid com letra maiúscula', () => {
    expect(violated(checkSelectors([suggestion('Login-Entrar')]))).toContain('testid-kebab')
})

it('acusa testid com espaço', () => {
    expect(violated(checkSelectors([suggestion('login entrar')]))).toContain('testid-kebab')
})

it('acusa testid de palavra única, que não nomeia ação nenhuma', () => {
    expect(violated(checkSelectors([suggestion('entrar')]))).toContain('testid-recurso-acao')
})

/** O corretor precisa saber qual refazer. */
it('reporta o testid ofensor na mensagem', () => {
    const violation = checkSelectors([suggestion('loginEntrar')])[0]

    expect(violation!.message).toContain('loginEntrar')
})

it('checa toda sugestão, não só a primeira', () => {
    const violations = checkSelectors([suggestion('login-entrar'), suggestion('loginSair')])

    expect(violated(violations)).toEqual(['testid-kebab'])
})
