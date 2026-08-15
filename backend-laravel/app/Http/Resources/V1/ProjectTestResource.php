<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectTestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'gherkin' => $this->gherkin,
            'playwright' => $this->playwright,
            'spec' => $this->spec,
            'feature' => $this->feature,
            'testRun' => $this->testRun ? TestRunResource::make($this->testRun) : null,
        ];
    }
}
