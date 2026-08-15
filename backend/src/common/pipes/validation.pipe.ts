/** A validação de entrada, que responde 422 com `{ message, errors: { campo: [] } }`. */
import { ValidationPipe } from '@nestjs/common'
import type { ValidationError } from 'class-validator'
import { ValidationFailed } from '../exceptions/errors.js'

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
        stopAtFirstError: true,
        exceptionFactory: (errors: ValidationError[]) => new ValidationFailed(collect(errors))
    })
}
