// @vitest-environment node
/** O cofre das credenciais de IA: o que entra cifrado tem que voltar igual, e lixo volta nulo. */
import { expect, it } from 'vitest'
import { decrypt, encrypt } from '../providers/crypto.js'

it('devolve o valor cifrado tal como entrou', () => {
  const cifrado = encrypt('sk-secreta')

  expect(cifrado).not.toContain('sk-secreta')
  expect(decrypt(cifrado)).toBe('sk-secreta')
})

it('cifra o mesmo valor de formas diferentes a cada vez', () => {
  expect(encrypt('sk-secreta')).not.toBe(encrypt('sk-secreta'))
})

it('trata como sem valor o que não é um cofre válido', () => {
  expect(decrypt(null)).toBeNull()
  expect(decrypt('')).toBeNull()
  expect(decrypt('não é base64 cifrado')).toBeNull()
  expect(decrypt(Buffer.from('curto').toString('base64'))).toBeNull()
})
