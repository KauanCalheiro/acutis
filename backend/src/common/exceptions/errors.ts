/** Os erros do domínio, que o `HttpErrorFilter` traduz em resposta HTTP. */
export class HttpError extends Error {
    constructor(readonly status: number, message: string) {
        super(message)
        this.name = new.target.name
    }
}

export class NotFound extends HttpError {
    constructor(message = 'Não encontrado.') {
        super(404, message)
    }
}

export class BadRequest extends HttpError {
    constructor(message: string) {
        super(400, message)
    }
}

/** Falha de validação. */
export class ValidationFailed extends HttpError {
    constructor(readonly errors: Record<string, string[]>, message = 'Os dados informados são inválidos.') {
        super(422, message)
    }
}
