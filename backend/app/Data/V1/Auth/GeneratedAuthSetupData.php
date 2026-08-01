<?php

namespace App\Data\V1\Auth;

use Spatie\LaravelData\Data;

class GeneratedAuthSetupData extends Data
{
    public function __construct(
        public string $authSetup,
        public bool $credentialsNeeded,
    ) {}
}
