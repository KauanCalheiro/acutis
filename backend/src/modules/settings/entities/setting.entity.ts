import { Column, Entity, PrimaryColumn } from 'typeorm'

/** Uma configuração global do acutis, guardada por chave. */
@Entity('settings')
export class Setting {
    @PrimaryColumn({ type: 'text' })
    key!: string

    @Column({ type: 'text', nullable: true })
    value!: string | null
}
