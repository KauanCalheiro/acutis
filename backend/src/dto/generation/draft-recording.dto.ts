import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    registerDecorator,
    type ValidationOptions
} from 'class-validator'
import type { RecordedEvent } from '../../modules/recording/events.js'
import type { DraftRecordingRequest } from '@acutis/contracts/generation'

/**
 * Cobra de cada evento os dois campos que o resto do fluxo exige: tipo e URL.
 *
 * ponytail: sem DTO aninhado, senão o `whitelist` do pipe apagaria os campos não declarados.
 */
function EveryEventIsUsable(options?: ValidationOptions) {
    return (object: object, propertyName: string): void => {
        registerDecorator({
            name: 'everyEventIsUsable',
            target: object.constructor,
            propertyName,
            options: { message: 'Todo evento precisa de um tipo e da URL em que ocorreu.', ...options },
            validator: {
                validate: (value: unknown) => !Array.isArray(value) || value.every(
                    (event: unknown) => typeof event === 'object'
                        && event !== null
                        && typeof (event as RecordedEvent).type === 'string'
                        && typeof (event as RecordedEvent).url === 'string'
                )
            }
        })
    }
}

export class DraftRecordingDto implements DraftRecordingRequest {
    @IsString({ message: 'A URL base da gravação é obrigatória.' })
    @IsNotEmpty({ message: 'A URL base da gravação é obrigatória.' })
    @IsUrl(
        { require_tld: false, require_protocol: true },
        { message: 'A URL base deve ser uma URL válida.' }
    )
    baseUrl!: string

    @IsArray({ message: 'A gravação precisa conter ao menos um evento.' })
    @ArrayMinSize(1, { message: 'A gravação precisa conter ao menos um evento.' })
    @EveryEventIsUsable()
    events!: RecordedEvent[]

    /** Onde o rascunho seria executado. */
    @IsOptional()
    @IsUrl(
        { require_tld: false, require_protocol: true },
        { message: 'A URL de execução deve ser uma URL válida.' }
    )
    executionUrl?: string | null

    /** Cenário gravado sem sessão: roda limpo, sem o storage state do projeto. */
    @IsOptional()
    @IsBoolean()
    isPublic?: boolean

    @IsOptional()
    @IsString()
    sessionId?: string | null

    @IsOptional()
    @IsString()
    recordedAt?: string | null

    @IsOptional()
    @IsString()
    video?: string | null
}
