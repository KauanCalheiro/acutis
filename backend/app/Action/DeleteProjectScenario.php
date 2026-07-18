<?php

namespace App\Action;

use App\Data\V1\Project\ScenarioData;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DeleteProjectScenario
{
    use AsAction;

    public function handle(string $slug, string $scenarioId): void
    {
        $path = Project::path($slug);
        $specRelative = "tests/{$scenarioId}.spec.ts";

        /** @var ScenarioData|null $scenario */
        $scenario = collect(ListProjectScenarios::run($path))
            ->first(fn (ScenarioData $candidate): bool => $candidate->spec === $specRelative);

        if (! $scenario) {
            throw new NotFoundHttpException('Cenário não encontrado.');
        }

        $spec = "{$path}/{$scenario->spec}";

        File::delete($spec);
        File::delete(Str::replaceLast('.spec.ts', '.events.json', $spec));

        if ($scenario->feature) {
            File::delete("{$path}/{$scenario->feature}");
        }
    }
}
