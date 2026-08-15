<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GeneratedTestsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'gherkin' => $this->gherkin,
            'playwright' => $this->playwright,
            'testRun' => $this->testRun ? TestRunResource::make($this->testRun) : null,
        ];
    }
}
