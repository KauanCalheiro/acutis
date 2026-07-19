<?php

namespace App\Action;

use App\Support\Project;
use App\Support\Scenario;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class DeleteProjectScenario
{
    use AsAction;

    public function handle(string $slug, string $scenarioId): void
    {
        $path = Project::path($slug);
        $scenario = Scenario::find($path, $scenarioId);

        $spec = "{$path}/{$scenario->spec}";

        File::delete($spec);
        File::delete(Str::replaceLast('.spec.ts', '.events.json', $spec));

        if ($scenario->feature) {
            File::delete("{$path}/{$scenario->feature}");
        }
    }
}
