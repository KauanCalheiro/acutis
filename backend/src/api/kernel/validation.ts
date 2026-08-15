/**
 * A validação de entrada, no formato de resposta que o Laravel devolvia.
 *
 * O padrão do Nest é 400 com `{ message: string[] }`. O frontend lê `{ message, errors: { campo: [] } }`
 * com 422, que é o do Laravel — manter o formato é o que permite trocar de backend sem tocar em
 * nenhuma tela de formulário.
 */
import { ValidationPipe } from '@nestjs/common'
import type { ValidationError } from 'class-validator'
import { ValidationFailed } from './errors.js'

function collect(errors: ValidationError[], into: Record<string, string[]> = {}, prefix = ''): Record<string, string[]> {
    for (const error of errors) {
        const field = prefix === '' ? error.property : `${prefix}.${error.property}`

        if (error.constraints) {
            into[field] = [...(into[field] ?? []), ...Object.values(error.constraints)]
        }

        if (error.children?.length) collect(error.children, into, field)
    }

    return into
}

export function validationPipe(): ValidationPipe {
    return new ValidationPipe({
        transform: true,
        whitelist: true,
        exceptionFactory: (errors: ValidationError[]) => new ValidationFailed(collect(errors))
    })
}
