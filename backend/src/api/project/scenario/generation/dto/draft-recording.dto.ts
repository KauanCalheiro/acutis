/** Portado de `App\Data\V1\Recording\RecordingData`. */
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
import type { RecordedEvent } from '../../../../recording/events.js'

/**
 * A gravação chega como lista solta de eventos, e não como classe: o gravador captura campos que o
 * backend nem lê, e declarar cada um aqui os apagaria (o pipe roda com `whitelist`). O que precisa
 * ser garantido é só o que o emissor lê de todo evento — tipo e URL.
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

export class DraftRecordingDto {
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

    /**
     * Onde o rascunho seria executado. Continua no contrato porque a tela o envia, mas nada é
     * executado aqui: o `SpecRunner` faz parte do que ficou para quando a IA voltar.
     */
    @IsOptional()
    @IsUrl(
        { require_tld: false, require_protocol: true },
        { message: 'A URL de execução deve ser uma URL válida.' }
    )
    executionUrl?: string | null

    /** Cenário gravado sem sessão: roda limpo, sem o storage state do projeto. */
    @IsOptional()
    @IsBoolean()
    publico?: boolean

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
