<?php

namespace App\Action;

use App\Data\V1\Auth\AuthSetupData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
use App\Support\AuthProjectFiles;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Lorisleiva\Actions\Concerns\AsAction;

class WriteAuthSetupToProject
{
    use AsAction;

    public function handle(string $slug, AuthSetupData $data): GeneratedAuthSetupData
    {
        $path = Project::path($slug);

        $generated = GenerateAuthSetup::run($data);

        AuthProjectFiles::writeConfig($path, $data->executionUrl ?? $data->loginUrl);
        File::put("{$path}/tests/auth.setup.ts", $generated->authSetup."\n");
        AuthProjectFiles::writeEnv($path, $data->username, $data->password);
        AuthProjectFiles::writeEnvExample($path);
        AuthProjectFiles::ensureGitignore($path);

        return $generated;
    }
}
