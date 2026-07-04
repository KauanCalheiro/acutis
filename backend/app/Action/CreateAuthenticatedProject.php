<?php

namespace App\Action;

use App\Data\V1\Auth\AuthSetupData;
use App\Data\V1\Auth\CreateAuthProjectData;
use App\Data\V1\Auth\CreatedAuthProjectData;
use App\Data\V1\Project\ProjectData;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;

class CreateAuthenticatedProject
{
    use AsAction;

    public function handle(CreateAuthProjectData $data): CreatedAuthProjectData
    {
        $generated = GenerateAuthSetup::run(new AuthSetupData(
            loginUrl: $data->loginUrl,
            username: $data->username,
            password: $data->password,
            executionUrl: $data->executionUrl,
        ));

        $slug = Str::slug($data->name);
        $path = acutis()->projectsPath."/{$slug}";
        $baseUrl = $data->executionUrl ?? $data->loginUrl;

        File::copyDirectory(base_path('stubs/playwright-auth'), $path);

        File::put("{$path}/package.json", str_replace('{{name}}', $slug, File::get("{$path}/package.json")));
        File::put("{$path}/playwright.config.ts", str_replace('{{baseUrl}}', $baseUrl, File::get("{$path}/playwright.config.ts")));
        File::put("{$path}/tests/auth.setup.ts", $generated->authSetup."\n");
        File::put("{$path}/.env", "AUTH_USER={$data->username}\nAUTH_PASSWORD={$data->password}\n");
        File::put("{$path}/.gitignore", implode("\n", [
            'node_modules', 'storage-state.json', '.env', 'results', 'playwright-report', 'test-results',
        ])."\n");

        $createdAt = WriteAcutisManifest::run($path, $data->name, $slug);

        return new CreatedAuthProjectData(
            project: new ProjectData(
                name: $data->name,
                slug: $slug,
                path: $path,
                created_at: $createdAt,
            ),
            storageCaptured: $generated->storageCaptured,
            testRun: $generated->testRun,
        );
    }
}
