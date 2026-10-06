/** O link `vscode://` que abre a pasta no VS Code, a partir do caminho de qualquer sistema. */
export function vscodeUrl(path: string): string {
  const forward = path.replace(/\\/g, '/')

  return `vscode://file${forward.startsWith('/') ? '' : '/'}${forward}`
}
