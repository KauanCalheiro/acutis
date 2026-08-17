/** O passo que quebrou e o erro que o runner mostrou — o que a tela envia ao pedir uma correção. */
import { IsNotEmpty, IsString } from 'class-validator'
import type { ScenarioFixRequest } from '@acutis/contracts/scenario'

export class ScenarioFixDto implements ScenarioFixRequest {
    @IsString()
    @IsNotEmpty({ message: 'O passo que falhou é obrigatório.' })
    step!: string

    @IsString()
    @IsNotEmpty({ message: 'O erro da execução é obrigatório.' })
    error!: string
}
