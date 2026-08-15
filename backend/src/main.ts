import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { HttpErrorFilter } from './api/kernel/http-error.filter.js'
import { installRequestLog } from './api/kernel/request-log.js'
import { validationPipe } from './api/kernel/validation.js'
import { AppModule } from './app.module.js'
import { CORS_ORIGIN, PORT } from './config/env.js'
import { AcutisWsAdapter } from './ws/acutis-ws.adapter.js'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)

    app.useWebSocketAdapter(new AcutisWsAdapter(app))

    // Os mesmos que o harness de teste monta. Sem o pipe, nenhum DTO valida e o 422 nunca acontece;
    // sem o filtro, um 404 de domínio chega ao frontend como 500.
    app.useGlobalPipes(validationPipe())
    app.useGlobalFilters(new HttpErrorFilter())

    // O diário em `runtime/logs/requests-<dia>.jsonl`: uma linha por requisição, com as chamadas
    // externas que ela disparou. Nenhuma outra parte do código sabe que ele existe.
    installRequestLog(app)

    app.enableCors({
        origin: CORS_ORIGIN,
        // A API migrada escreve, não só lê: sem POST, PUT e PATCH, criar projeto e salvar cenário
        // morrem no preflight.
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
    })

    await app.listen(PORT)

    console.log(`[INFO] acutis listening on :${PORT}`)
}

bootstrap()
