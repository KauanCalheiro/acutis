<?php

namespace App\Action;

use App\Data\V1\Project\ProjectRunData;
use App\Support\Project;
use Illuminate\Support\Facades\Http;
use Lorisleiva\Actions\Concerns\AsAction;

class RunProject
{
    use AsAction;

    public function handle(string $slug, ?string $spec = null, ?string $grep = null): ProjectRunData
    {
        $path = Project::path($slug);

        $result = Http::timeout(300)
            ->post(acutis()->webdriverUrl.'/runner/project', [
                'path' => $path,
                'spec' => $spec,
                'grep' => $grep,
            ])
            ->throw()
            ->json();

        return new ProjectRunData(
            passed: (bool) ($result['passed'] ?? false),
            output: (string) ($result['output'] ?? ''),
        );
    }
}
