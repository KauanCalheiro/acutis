<?php

namespace App\Action;

use App\Data\V1\Auth\AuthSetupData;
use App\Data\V1\Auth\GeneratedAuthSetupData;
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

        $baseUrl = $data->executionUrl ?? $data->loginUrl;
        $config = str_replace(
            '{{baseUrl}}',
            $baseUrl,
            File::get(base_path('stubs/playwright-auth/playwright.config.ts')),
        );

        File::ensureDirectoryExists("{$path}/tests");
        File::put("{$path}/playwright.config.ts", $config);
        File::put("{$path}/tests/auth.setup.ts", $generated->authSetup."\n");
        File::put("{$path}/.env", "AUTH_USER={$data->username}\nAUTH_PASSWORD={$data->password}\n");
        $this->ensureGitignore($path);

        return $generated;
    }

    private function ensureGitignore(string $path): void
    {
        $file = "{$path}/.gitignore";
        $existing = File::exists($file) ? File::get($file) : '';
        $lines = ['node_modules', 'storage-state.json', '.env', 'results', 'playwright-report', 'test-results'];

        $missing = array_filter($lines, fn (string $line): bool => ! str_contains($existing, $line));

        if ($missing === []) {
            return;
        }

        File::put($file, rtrim($existing."\n".implode("\n", $missing), "\n")."\n");
    }
}
