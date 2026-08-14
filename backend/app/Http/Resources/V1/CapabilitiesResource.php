<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CapabilitiesResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'git' => $this->resource['git'],
        ];
    }
}
