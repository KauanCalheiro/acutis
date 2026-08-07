<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** A chave nunca sai daqui: a tela só precisa saber se existe uma. */
class AiSettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'provider' => $this->resource['provider'],
            'key_set' => $this->resource['key_set'],
            'providers' => $this->resource['providers'],
        ];
    }
}
