<?php

namespace App\Data\V1\Auth;

use App\Data\V1\Recording\TestRunData;
use Spatie\LaravelData\Data;

class GeneratedAuthSetupData extends Data
{
    public function __construct(
        public string $authSetup,
        public bool $storageCaptured,
        public ?TestRunData $testRun = null,
        public ?string $snapshot = null,
    ) {}
}
