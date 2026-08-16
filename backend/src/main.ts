import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { HttpErrorFilter } from './common/filters/http-error.filter.js'
import { installRequestLog } from './common/interceptors/request-log.interceptor.js'
import { validationPipe } from './common/pipes/validation.pipe.js'
import { AppModule } from './app.module.js'
import { CORS_ORIGIN, LOG_LEVELS, PORT } from './config/env.js'
import { AcutisWsAdapter } from './webdriver/gateway/acutis-ws.adapter.js'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, { logger: LOG_LEVELS })

    app.useWebSocketAdapter(new AcutisWsAdapter(app))

    app.useGlobalPipes(validationPipe())
    app.useGlobalFilters(new HttpErrorFilter())

    // O diário em `runtime/logs/requests-<dia>.jsonl`: uma linha por requisição.
    installRequestLog(app)

    app.enableCors({
        origin: CORS_ORIGIN,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
    })

    await app.listen(PORT)

    // Pelo logger, e não por console.log, para obedecer ao LOG_LEVEL como o resto do boot.
    new Logger('Bootstrap').log(`acutis listening on :${PORT}`)
}

bootstrap()
