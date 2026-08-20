import { EntitySchema } from 'typeorm'

/** Uma configuração global do acutis, guardada por chave. */
export class Setting {
  key!: string
  value!: string | null
}

export const SettingSchema = new EntitySchema<Setting>({
  name: 'Setting',
  target: Setting,
  tableName: 'settings',
  columns: {
    key: { type: 'text', primary: true },
    value: { type: 'text', nullable: true }
  }
})
