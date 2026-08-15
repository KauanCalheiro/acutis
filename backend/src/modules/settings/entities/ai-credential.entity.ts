import { Column, Entity, PrimaryColumn } from 'typeorm'

/** O cadastro de um provedor de IA. A chave fica cifrada na coluna. */
@Entity('ai_settings')
export class AiCredential {
    @PrimaryColumn({ type: 'text' })
    provider!: string

    @Column({ type: 'text', nullable: true })
    key!: string | null

    @Column({ type: 'text', nullable: true })
    url!: string | null

    @Column({ type: 'text', nullable: true })
    model!: string | null
}
