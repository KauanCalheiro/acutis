<?php

use App\Ai\Agents\AuthRecordingWriter;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function recordProject(string $name = 'Portal Sistema'): string
{
    postJson('/api/v1/projects/create/template', ['name' => $name])->assertCreated();

    return Str::slug($name);
}

function recordPayload(array $overrides = []): array
{
    return array_merge([
        'baseUrl' => 'https://sistema.test/login',
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => null, 'label' => null, 'value' => null, 'sensitive' => false],
            ['type' => 'fill', 'timestamp' => 2, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'user'], 'label' => 'Usuário', 'value' => 'user1', 'sensitive' => false],
            ['type' => 'fill', 'timestamp' => 3, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'pass'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true],
            ['type' => 'submit', 'timestamp' => 4, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'entrar'], 'label' => 'Entrar', 'value' => null, 'sensitive' => false],
        ],
    ], $overrides);
}

it('writes the generated auth setup from the recording into the project folder', function () {
    AuthRecordingWriter::fake([['authSetup' => "import { test as setup } from '@playwright/test' // login gravado"]]);
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())
        ->assertOk()
        ->assertJsonPath('authSetup', fn ($v) => str_contains($v, 'login gravado'));

    $dir = $this->projectsPath."/{$slug}";

    expect(File::get($dir.'/tests/auth.setup.ts'))->toContain('login gravado')
        ->and(File::get($dir.'/playwright.config.ts'))->toContain("baseURL: 'https://sistema.test/login'")
        ->and(File::exists($dir.'/.gitignore'))->toBeTrue();
});

it('shows the recorded events to the writer', function () {
    AuthRecordingWriter::fake();
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthRecordingWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'https://sistema.test/login')
            && str_contains($prompt->prompt, '••••')
            && str_contains($prompt->prompt, 'dataTestId')
    );
});

it('redacts the sensitive value before showing events to the writer', function () {
    AuthRecordingWriter::fake();
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthRecordingWriter::assertPrompted(
        fn ($prompt) => ! str_contains($prompt->prompt, 'topsecret123')
    );
});

it('writes the recorded credentials into .env and a placeholder .env.example', function () {
    AuthRecordingWriter::fake();
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    $dir = $this->projectsPath."/{$slug}";

    expect(File::get($dir.'/.env'))
        ->toContain('AUTH_USER=user1')
        ->toContain('AUTH_PASSWORD=topsecret123')
        ->and(File::get($dir.'/.env.example'))
        ->toContain('AUTH_USER=')
        ->toContain('AUTH_PASSWORD=')
        ->not->toContain('topsecret123')
        ->and(File::get($dir.'/.gitignore'))->toContain('.env');
});

it('returns 404 for a project that does not exist', function () {
    AuthRecordingWriter::fake();
    Http::fake();

    postJson('/api/v1/projects/inexistente/auth/record', recordPayload())->assertNotFound();
});

it('validates the recording payload', function () {
    AuthRecordingWriter::fake();
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", ['events' => []])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['baseUrl', 'events']);
});
