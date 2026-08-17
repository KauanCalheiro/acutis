import { IsNotEmpty, IsString } from 'class-validator'
import type { ProbeRepositoryRequest } from '@acutis/contracts/git'

export class ProbeRepositoryDto implements ProbeRepositoryRequest {
    @IsString({ message: 'A URL do repositório é obrigatória.' })
    @IsNotEmpty({ message: 'A URL do repositório é obrigatória.' })
    url!: string
}
