/** O que a tela manda para testar o cadastro antes de salvá-lo: o mesmo do catálogo, mais o modelo. */
import { IsNotEmpty, IsString } from 'class-validator'
import { ListModelsDto } from './list-models.dto.js'

export class PingModelDto extends ListModelsDto {
    @IsString({ message: 'Escolha o modelo antes de testar.' })
    @IsNotEmpty({ message: 'Escolha o modelo antes de testar.' })
    model!: string
}
