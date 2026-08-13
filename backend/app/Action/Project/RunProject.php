<?php

namespace App\Action\Project;

use App\Data\V1\Project\ProjectRunData;
use App\Support\Project;
use Illuminate\Support\Facades\Http;
use Lorisleiva\Actions\Concerns\AsAction;

class RunProject
{
    use AsAction;

    public function handle(string $slug, ?string $spec = null, ?string $grep = null): ProjectRunData
    {
        $project = Project::make($slug);
        $environment = $project->environments()->resolve();

        $result = Http::timeout(300)
            ->post(acutis()->webdriverUrl.'/runner/project', [
                'path' => $project->path(),
                'spec' => $spec,
                'grep' => $grep,
                'env' => blank($environment) ? null : $environment,
            ])
            ->throw()
            ->json();

        return new ProjectRunData(
            passed: (bool) ($result['passed'] ?? false),
            output: (string) ($result['output'] ?? ''),
        );
    }
}
