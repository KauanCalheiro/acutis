/**
 * A API que está sendo migrada do Laravel.
 *
 * Entra no Nest ao lado de recorder e runner, e pode chamá-los por injeção — nunca o contrário. É a
 * fronteira que mantém o gravador ignorante de quem o usa.
 */
import { Module } from '@nestjs/common'
import { ProjectModule } from './project/project.module.js'

@Module({
    imports: [ProjectModule]
})
export class ApiModule {}
