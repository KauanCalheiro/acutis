// @vitest-environment node
/** O link que abre a pasta do projeto no VS Code. */
import { expect, it } from 'vitest'
import { vscodeUrl } from '#shared/utils/vscode'

it('monta o link a partir de um caminho posix', () => {
  expect(vscodeUrl('/home/kauan/.acutis/loja')).toBe('vscode://file/home/kauan/.acutis/loja')
})

it('monta o link a partir de um caminho do Windows', () => {
  expect(vscodeUrl('C:\\Users\\kauan\\.acutis\\loja')).toBe('vscode://file/C:/Users/kauan/.acutis/loja')
})
