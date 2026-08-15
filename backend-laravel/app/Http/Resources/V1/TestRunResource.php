<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TestRunResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'executed' => $this->executed,
            'passed' => $this->passed,
            'attempts' => $this->attempts,
            'error' => $this->error,
        ];
    }
}
