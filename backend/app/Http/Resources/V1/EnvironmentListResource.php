<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EnvironmentListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'active' => $this['active'],
            'environments' => EnvironmentResource::collection($this['environments']),
            'known_keys' => $this['known_keys'],
            'dotenv_keys' => $this['dotenv_keys'],
        ];
    }
}
