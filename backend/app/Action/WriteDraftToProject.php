<?php

namespace App\Action;

use App\Data\V1\Recording\ProjectTestData;
use App\Data\V1\Recording\WriteTestData;
use App\Support\AuthProjectFiles;
use App\Support\Project;
use App\Support\RecordingEvents;
use App\Support\TestArtifact;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class WriteDraftToProject
{
    use AsAction;

    public function handle(string $slug, WriteTestData $data): ProjectTestData
    {
        $path = Project::path($slug);
        $domain = Str::slug($data->domain) ?: 'outros';

        $name = TestArtifact::uniquePath("{$path}/tests/{$domain}", Str::slug($data->path) ?: 'teste');
        $spec = "tests/{$domain}/{$name}.spec.ts";
        $feature = "features/{$domain}/{$name}.feature";

        $gherkin = TestArtifact::stampGherkinTags(
            TestArtifact::stampTitle($data->gherkin, $data->title),
            $data->tags,
        );
        $playwright = TestArtifact::stampPlaywrightTags($data->playwright, $data->tags);

        File::ensureDirectoryExists("{$path}/tests/{$domain}");
        File::ensureDirectoryExists("{$path}/features/{$domain}");
        File::put("{$path}/{$spec}", $playwright."\n");
        File::put("{$path}/{$feature}", $gherkin."\n");

        if ($data->events !== null) {
            if ($warning = RecordingEvents::unmatchedEnvWarning($data->envVars, $data->events)) {
                Log::warning($warning);
            }

            $envValues = RecordingEvents::matchEnvValues($data->envVars, $data->events);

            if ($envValues !== []) {
                AuthProjectFiles::mergeEnv($path, $envValues);
                AuthProjectFiles::ensureGitignore($path);
            }

            File::put(
                "{$path}/tests/{$domain}/{$name}.events.json",
                json_encode(RecordingEvents::redact($data->events), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            );
        }

        return new ProjectTestData(
            gherkin: $gherkin,
            playwright: $playwright,
            spec: $spec,
            feature: $feature,
        );
    }
}
