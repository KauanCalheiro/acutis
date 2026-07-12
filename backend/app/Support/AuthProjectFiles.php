<?php

namespace App\Support;

use Illuminate\Support\Facades\File;

final class AuthProjectFiles
{
    public static function writeConfig(string $path, string $baseUrl): void
    {
        $config = str_replace(
            '{{baseUrl}}',
            $baseUrl,
            File::get(base_path('stubs/playwright-auth/playwright.config.ts')),
        );

        File::ensureDirectoryExists("{$path}/tests");
        File::put("{$path}/playwright.config.ts", $config);
    }

    public static function ensureGitignore(string $path): void
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
