<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FixedSpecResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'playwright' => $this->playwright,
            'summary' => $this->summary,
        ];
    }
}
