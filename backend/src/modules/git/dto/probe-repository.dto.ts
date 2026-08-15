import { IsNotEmpty, IsString } from 'class-validator'

export class ProbeRepositoryDto {
    @IsString({ message: 'A URL do repositório é obrigatória.' })
    @IsNotEmpty({ message: 'A URL do repositório é obrigatória.' })
    url!: string
}
