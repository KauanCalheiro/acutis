<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreatedAuthProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'project' => ProjectResource::make($this->project),
            'storageCaptured' => $this->storageCaptured,
            'testRun' => $this->testRun ? TestRunResource::make($this->testRun) : null,
        ];
    }
}
