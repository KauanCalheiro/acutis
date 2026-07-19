<?php

namespace App\Action;

use App\Data\V1\Project\ScenarioShowData;
use App\Data\V1\Project\UpdateScenarioData;
use App\Support\Project;
use App\Support\Scenario;
use App\Support\TestArtifact;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Lorisleiva\Actions\Concerns\AsAction;

class UpdateProjectScenario
{
    use AsAction;

    public function handle(string $slug, string $scenarioId, UpdateScenarioData $data): ScenarioShowData
    {
        $path = Project::path($slug);
        $scenario = Scenario::find($path, $scenarioId);

        $domain = Str::slug($data->domain ?? '') ?: null;
        $name = Str::slug($data->path) ?: 'teste';
        $newSpecRelative = $domain ? "tests/{$domain}/{$name}.spec.ts" : "tests/{$name}.spec.ts";
        $newFeatureRelative = $domain ? "features/{$domain}/{$name}.feature" : "features/{$name}.feature";

        if ($newSpecRelative !== $scenario->spec && File::exists("{$path}/{$newSpecRelative}")) {
            throw ValidationException::withMessages([
                'path' => 'Já existe um cenário com este nome neste domínio.',
            ]);
        }

        $gherkin = TestArtifact::stampGherkinTags(
            TestArtifact::stampTitle($data->gherkin, $data->title),
            $data->tags,
        );
        $playwright = TestArtifact::stampPlaywrightTags($data->playwright, $data->tags);

        File::ensureDirectoryExists(dirname("{$path}/{$newSpecRelative}"));
        File::ensureDirectoryExists(dirname("{$path}/{$newFeatureRelative}"));
        File::put("{$path}/{$newSpecRelative}", $playwright."\n");
        File::put("{$path}/{$newFeatureRelative}", $gherkin."\n");

        if ($newSpecRelative !== $scenario->spec) {
            File::delete("{$path}/{$scenario->spec}");

            if ($scenario->feature) {
                File::delete("{$path}/{$scenario->feature}");
            }

            $oldEvents = Str::replaceLast('.spec.ts', '.events.json', "{$path}/{$scenario->spec}");

            if (File::exists($oldEvents)) {
                File::move($oldEvents, Str::replaceLast('.spec.ts', '.events.json', "{$path}/{$newSpecRelative}"));
            }
        }

        $newScenarioId = $domain ? "{$domain}/{$name}" : $name;

        return ShowProjectScenario::run($slug, $newScenarioId);
    }
}
