/**
 * Os erros que a API traduz em resposta HTTP.
 *
 * São classes próprias, e não as do Nest, para o domínio não importar o framework: quem escreve uma
 * action não precisa saber que existe HTTP do outro lado.
 */
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

/** Falha de validação: o formato que o frontend já espera do Laravel. */
export class ValidationFailed extends HttpError {
    constructor(readonly errors: Record<string, string[]>, message = 'Os dados informados são inválidos.') {
        super(422, message)
    }
}
