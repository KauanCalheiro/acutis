import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { CORS_ORIGIN, PORT } from './config/env.js'
import { AcutisWsAdapter } from './ws/acutis-ws.adapter.js'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)

    app.useWebSocketAdapter(new AcutisWsAdapter(app))

    app.enableCors({
        origin: CORS_ORIGIN,
        methods: ['GET', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
    })

    await app.listen(PORT)

    console.log(`[INFO] acutis-webdriver listening on :${PORT}`)
}

bootstrap()
