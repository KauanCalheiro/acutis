import { EntitySchema } from 'typeorm'

/** O cadastro de um provedor de IA. A chave fica cifrada na coluna. */
export class AiCredential {
  provider!: string
  key!: string | null
  url!: string | null
  model!: string | null
}

export const AiCredentialSchema = new EntitySchema<AiCredential>({
  name: 'AiCredential',
  target: AiCredential,
  tableName: 'ai_settings',
  columns: {
    provider: { type: 'text', primary: true },
    key: { type: 'text', nullable: true },
    url: { type: 'text', nullable: true },
    model: { type: 'text', nullable: true }
  }
})
