/**
 * Traduz os erros do domínio em resposta HTTP, no formato que o frontend já espera do Laravel.
 *
 * O 422 leva `{ message, errors }` porque é assim que o Nuxt lê a validação hoje; mudar o formato
 * obrigaria a mexer em toda tela de formulário.
 */
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { HttpError, ValidationFailed } from './errors.js'

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
