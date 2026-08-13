<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A chave de cada provedor sai daqui em claro, e é intencional: o acutis roda na máquina de quem
 * o usa, sem multiusuário, e poder conferir a chave guardada vale mais do que escondê-la de quem
 * a digitou. A tela a mostra mascarada, com botão de revelar.
 */
class AiSettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'provider' => $this->resource['provider'],
            'credentials' => $this->resource['credentials'],
            'providers' => $this->resource['providers'],
            'provider_urls' => $this->resource['provider_urls'],
        ];
    }
}
