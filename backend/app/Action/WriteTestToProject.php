<?php

namespace App\Action;

use App\Data\V1\Recording\ProjectTestData;
use App\Data\V1\Recording\RecordingData;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class WriteTestToProject
{
    use AsAction;

    public function handle(string $slug, RecordingData $data): ProjectTestData
    {
        $path = Project::path($slug);

        $generated = GenerateTestsFromRecording::run($data);

        $name = $this->uniqueName($path, $this->baseName($generated->gherkin));
        $spec = "tests/{$name}.spec.ts";
        $feature = "features/{$name}.feature";

        File::ensureDirectoryExists("{$path}/tests");
        File::ensureDirectoryExists("{$path}/features");
        File::put("{$path}/{$spec}", $generated->playwright."\n");
        File::put("{$path}/{$feature}", $generated->gherkin."\n");

        return new ProjectTestData(
            gherkin: $generated->gherkin,
            playwright: $generated->playwright,
            spec: $spec,
            feature: $feature,
            testRun: $generated->testRun,
        );
    }

    private function baseName(string $gherkin): string
    {
        preg_match('/Funcionalidade:\s*(.+)/u', $gherkin, $matches);

        return Str::slug($matches[1] ?? '') ?: 'teste';
    }

    private function uniqueName(string $path, string $name): string
    {
        $candidate = $name;
        $suffix = 1;

        while (File::exists("{$path}/tests/{$candidate}.spec.ts")) {
            $suffix++;
            $candidate = "{$name}-{$suffix}";
        }

        return $candidate;
    }
}
