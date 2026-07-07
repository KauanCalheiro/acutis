<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TestDraftResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'title' => $this->title,
            'tags' => $this->tags,
            'domain' => $this->domain,
            'path' => $this->path,
            'gherkin' => $this->gherkin,
            'playwright' => $this->playwright,
        ];
    }
}
