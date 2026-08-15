import { MigrationInterface, QueryRunner, Table } from 'typeorm'

/** O cadastro de IA, uma linha por provedor. A chave fica cifrada na coluna. */
export class CreateAiSettingsTable1737100001000 implements MigrationInterface {
    async up(runner: QueryRunner): Promise<void> {
        await runner.createTable(
            new Table({
                name: 'ai_settings',
                columns: [
                    { name: 'provider', type: 'text', isPrimary: true },
                    { name: 'key', type: 'text', isNullable: true },
                    { name: 'url', type: 'text', isNullable: true },
                    { name: 'model', type: 'text', isNullable: true }
                ]
            }),
            true
        )
    }

    async down(runner: QueryRunner): Promise<void> {
        await runner.dropTable('ai_settings')
    }
}
