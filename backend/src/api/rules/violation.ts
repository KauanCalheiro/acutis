/**
 * Uma regra quebrada no arquivo gerado.
 *
 * O `fixable` separa quem conserta: o corretor resolve o que é erro de escrita, mas variável sem
 * valor só o usuário preenche, e mandar isso para o loop o faria girar até o limite sem chance de
 * acertar.
 */
export interface Violation {
    rule: string
    message: string
    fixable: boolean
}

export function violation(rule: string, message: string, fixable = true): Violation {
    return { rule, message, fixable }
}

/** Os slugs das regras violadas, na ordem em que saíram. */
export function violated(violations: Violation[]): string[] {
    return violations.map((item) => item.rule)
}
