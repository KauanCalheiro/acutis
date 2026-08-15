<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'name' => $this->name,
            'slug' => $this->slug,
            'path' => $this->path,
            'repository' => $this->repository,
            'provider' => $this->provider?->value,
            'created_at' => $this->created_at,
        ];
    }
}
