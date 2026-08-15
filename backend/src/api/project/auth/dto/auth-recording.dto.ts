/**
 * Portado de `App\Data\V1\Auth\AuthRecordingData`.
 */
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, IsUrl, registerDecorator, type ValidationOptions } from 'class-validator'
import type { RecordedEvent } from '../../../recording/events.js'

/** Sem esquema, `sistema.test` passaria por URL; sem TLD, um `app.local` interno não passaria. */
const URL_FORMAT = { require_tld: false, require_protocol: true }

/**
 * O evento sem tipo ou sem URL não vira passo nenhum, e chegaria ao emitter para quebrar lá dentro.
 *
 * ponytail: valida os dois campos que o resto do fluxo exige, sem DTO aninhado. Um DTO por evento
 * exigiria declarar os onze seletores só para o `whitelist` não os apagar do payload.
 */
function HasRecordedEvents(options?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'hasRecordedEvents',
            target: object.constructor,
            propertyName,
            options: { message: 'Todo evento precisa de um tipo e da URL em que ocorreu.', ...options },
            validator: {
                validate: (value: unknown) => Array.isArray(value) && value.every((event) => {
                    const recorded = event as Partial<RecordedEvent> | null

                    return typeof recorded?.type === 'string' && typeof recorded.url === 'string'
                })
            }
        })
    }
}

export class AuthRecordingDto {
    @IsString({ message: 'A URL base da gravação é obrigatória.' })
    @IsNotEmpty({ message: 'A URL base da gravação é obrigatória.' })
    @IsUrl(URL_FORMAT, { message: 'A URL base deve ser uma URL válida.' })
    baseUrl!: string

    @IsArray({ message: 'A gravação precisa conter ao menos um evento.' })
    @ArrayNotEmpty({ message: 'A gravação precisa conter ao menos um evento.' })
    @HasRecordedEvents()
    events!: RecordedEvent[]

    /** Sem ela não há onde rodar o login, e a geração se guia só pelas regras. */
    @IsOptional()
    @IsUrl(URL_FORMAT, { message: 'A URL de execução deve ser uma URL válida.' })
    executionUrl?: string
}
