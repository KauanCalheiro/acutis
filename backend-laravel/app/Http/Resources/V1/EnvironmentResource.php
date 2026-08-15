<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EnvironmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this['slug'],
            'name' => $this['name'],
            'vars' => EnvironmentVarResource::collection($this['vars']),
        ];
    }
}
