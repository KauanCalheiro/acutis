/** A palavra que concorda com a quantidade: `plural(1, 'cenário', 'cenários')`. */
export function plural(count: number, singular: string, many: string): string {
  return count === 1 ? singular : many
}

/** A contagem por extenso, com uma frase própria para o zero: `counted(0, ..., 'nenhum falhou')`. */
export function counted(count: number, singular: string, many: string, none: string): string {
  return count === 0 ? none : `${count} ${plural(count, singular, many)}`
}
