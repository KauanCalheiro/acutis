/** Traduz os erros do domínio em resposta HTTP; o 422 leva `{ message, errors }`. */
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { HttpError, ValidationFailed } from '../exceptions/errors.js'

@Catch(HttpError)
export class HttpErrorFilter implements ExceptionFilter {
    catch(error: HttpError, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>()

        if (error instanceof ValidationFailed) {
            response.status(error.status).json({ message: error.message, errors: error.errors })

            return
        }

        response.status(error.status).json({ message: error.message })
    }
}
