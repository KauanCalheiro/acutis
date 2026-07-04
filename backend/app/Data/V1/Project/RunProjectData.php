<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Data;

class RunProjectData extends Data
{
    public function __construct(
        public ?string $spec = null,
        public ?string $grep = null,
    ) {}

    public static function rules(): array
    {
        return [
            'spec' => ['nullable', 'string'],
            'grep' => ['nullable', 'string'],
        ];
    }
}
