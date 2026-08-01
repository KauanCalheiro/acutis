<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectSettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'base_url' => $this->resource,
        ];
    }
}
