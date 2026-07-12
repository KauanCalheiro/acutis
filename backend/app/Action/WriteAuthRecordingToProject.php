<?php

namespace App\Action;

use App\Data\V1\Auth\AuthRecordingData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use App\Support\AuthProjectFiles;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class WriteAuthRecordingToProject
{
    use AsAction;

    public function handle(string $slug, AuthRecordingData $data): GeneratedAuthSetupData
    {
        $path = Project::path($slug);

        $generated = GenerateAuthSetupFromRecording::run($data);

        AuthProjectFiles::writeConfig($path, $data->executionUrl ?? $data->baseUrl);
        File::put("{$path}/tests/auth.setup.ts", $generated->authSetup."\n");
        AuthProjectFiles::ensureGitignore($path);

        return $generated;
    }
}
