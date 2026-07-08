<?php

namespace App\Action;

use App\Data\V1\Recording\ProjectTestData;
use App\Data\V1\Recording\WriteTestData;
use App\Support\Project;
use App\Support\TestArtifact;
use Illuminate\Support\Facades\File;
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

        return new ProjectTestData(
            gherkin: $gherkin,
            playwright: $playwright,
            spec: $spec,
            feature: $feature,
        );
    }
}
