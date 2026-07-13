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

        $this->write($path, $data, $generated);

        if (! $generated->testRun?->passed) {
            dispatch(function () use ($path, $data, $generated): void {
                $retried = app(GenerateAuthSetup::class)->retry($data, $generated);

                if ($retried->testRun?->passed) {
                    $this->write($path, $data, $retried);
                }
            })->afterResponse();
        }

        return $generated;
    }

    private function write(string $path, AuthSetupData $data, GeneratedAuthSetupData $generated): void
    {
        AuthProjectFiles::writeConfig($path, $data->executionUrl ?? $data->loginUrl);
        File::put("{$path}/tests/auth.setup.ts", $generated->authSetup."\n");
        File::put("{$path}/.env", "AUTH_USER={$data->username}\nAUTH_PASSWORD={$data->password}\n");
        AuthProjectFiles::ensureGitignore($path);
    }
}
