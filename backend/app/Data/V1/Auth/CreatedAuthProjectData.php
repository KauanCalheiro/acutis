<?php

namespace App\Data\V1\Auth;

use App\Data\V1\Project\ProjectData;
use App\Data\V1\Recording\TestRunData;
use Spatie\LaravelData\Data;

class CreatedAuthProjectData extends Data
{
    public function __construct(
        public ProjectData $project,
        public bool $storageCaptured,
        public ?TestRunData $testRun = null,
    ) {}
}
