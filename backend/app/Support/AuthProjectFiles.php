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

    public static function writeEnv(string $path, string $username, string $password): void
    {
        File::put("{$path}/.env", "AUTH_USER={$username}\nAUTH_PASSWORD={$password}\n");
    }

    public static function writeEnvExample(string $path): void
    {
        File::put("{$path}/.env.example", "AUTH_USER=\nAUTH_PASSWORD=\n");
    }

    /** Atualiza (ou cria) chaves específicas do .env/.env.example do projeto sem apagar as demais já existentes. */
    public static function mergeEnv(string $path, array $values): void
    {
        self::mergeEnvFile("{$path}/.env", $values);
        self::mergeEnvFile("{$path}/.env.example", array_fill_keys(array_keys($values), ''));
    }

    private static function mergeEnvFile(string $file, array $values): void
    {
        $existing = File::exists($file) ? File::get($file) : '';
        $lines = $existing === '' ? [] : explode("\n", rtrim($existing, "\n"));

        foreach ($values as $key => $value) {
            $index = self::findLineIndex($lines, $key);

            if ($index !== null) {
                $lines[$index] = "{$key}={$value}";
            } else {
                $lines[] = "{$key}={$value}";
            }
        }

        File::put($file, implode("\n", $lines)."\n");
    }

    private static function findLineIndex(array $lines, string $key): ?int
    {
        foreach ($lines as $index => $line) {
            if (str_starts_with($line, "{$key}=")) {
                return $index;
            }
        }

        return null;
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
