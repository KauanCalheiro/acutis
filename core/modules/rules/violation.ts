/** Uma regra quebrada no arquivo gerado; o `fixable` diz se o corretor pode resolvê-la. */
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
  return violations.map(item => item.rule)
}
