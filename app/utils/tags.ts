export function tagColor(tag: string) {
  if (tag === '@read') return 'success'
  if (tag === '@write') return 'warning'
  return 'primary'
}
