<?php

namespace App\Http\Resources\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GeneratedAuthSetupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'authSetup' => $this->authSetup,
            'credentialsNeeded' => $this->credentialsNeeded,
            'warnings' => $this->warnings,
        ];
    }
}
