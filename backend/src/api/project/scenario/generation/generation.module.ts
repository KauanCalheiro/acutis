import { Module } from '@nestjs/common'
import { ProjectModule } from '../../project.module.js'
import { GenerationController } from './generation.controller.js'
import { GenerationService } from './generation.service.js'

@Module({
    imports: [ProjectModule],
    controllers: [GenerationController],
    providers: [GenerationService]
})
export class GenerationModule {}
