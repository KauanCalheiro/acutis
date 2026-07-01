<?php

namespace App\Data\V1\Project;

use App\Enums\GitProvider;
use Spatie\LaravelData\Data;

class ProjectData extends Data
{
    public function __construct(
        public string $name,
        public string $slug,
        public string $path,
        public ?string $repository = null,
        public ?GitProvider $provider = null,
        public ?string $created_at = null,
    ) {}
}
