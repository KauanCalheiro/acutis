import { Table } from 'typeorm'
import type { MigrationInterface, QueryRunner } from 'typeorm'

/** A tabela de configurações globais, uma linha por chave. */
export class CreateSettingsTable1737100000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.createTable(
      new Table({
        name: 'settings',
        columns: [
          { name: 'key', type: 'text', isPrimary: true },
          { name: 'value', type: 'text', isNullable: true }
        ]
      }),
      true
    )
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.dropTable('settings')
  }
}
