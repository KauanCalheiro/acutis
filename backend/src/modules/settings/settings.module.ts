import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { databaseOptions } from '../../config/database.js'
import { AiCredential } from './entities/ai-credential.entity.js'
import { Setting } from './entities/setting.entity.js'
import { SettingsController } from './settings.controller.js'
import { SettingsService } from './settings.service.js'

@Module({
    imports: [
        TypeOrmModule.forRootAsync({ useFactory: databaseOptions }),
        TypeOrmModule.forFeature([Setting, AiCredential])
    ],
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService]
})
export class SettingsModule {}
