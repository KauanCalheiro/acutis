<?php

use App\Ai\Agents\AuthRecordingWriter;
use App\Ai\Agents\AuthSetupWriter;
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
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
            ['type' => 'fill', 'timestamp' => 2, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'user'], 'label' => 'Usuário', 'value' => 'user1', 'inputType' => 'text'],
            ['type' => 'fill', 'timestamp' => 3, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'pass'], 'label' => 'Senha', 'value' => 'topsecret123', 'inputType' => 'password'],
            ['type' => 'submit', 'timestamp' => 4, 'url' => 'https://sistema.test/login', 'selectors' => ['dataTestId' => 'entrar'], 'label' => 'Entrar', 'value' => null, 'inputType' => null],
        ],
    ], $overrides);
}

function fakeSuccessfulFallback(): void
{
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [['name' => 'sess']]]]),
    ]);
}

it('writes the generated auth setup from the recording into the project folder', function () {
    AuthRecordingWriter::fake([['authSetup' => "import { test as setup } from '@playwright/test' // login gravado"]]);
    fakeSuccessfulFallback();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())
        ->assertOk()
        ->assertJsonPath('authSetup', fn ($v) => str_contains($v, 'login gravado'));

    $dir = $this->projectsPath."/{$slug}";

    expect(File::get($dir.'/tests/auth.setup.ts'))->toContain('login gravado')
        ->and(File::get($dir.'/playwright.config.ts'))->toContain("baseURL: 'https://sistema.test/login'")
        ->and(File::exists($dir.'/.gitignore'))->toBeTrue();
});

it('shows the recorded events to the writer, redacting the real password first', function () {
    AuthRecordingWriter::fake();
    fakeSuccessfulFallback();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())->assertOk();

    AuthRecordingWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'https://sistema.test/login')
            && str_contains($prompt->prompt, '••••')
            && ! str_contains($prompt->prompt, 'topsecret123')
            && str_contains($prompt->prompt, 'dataTestId')
    );
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

it('captures the session straight from the storageState of the live recording, without executing anything', function () {
    AuthRecordingWriter::fake([['authSetup' => "import { test as setup } from '@playwright/test' // login gravado"]]);
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'storageState' => ['cookies' => [['name' => 'sess', 'value' => 'abc']], 'origins' => []],
    ]))
        ->assertOk()
        ->assertJsonPath('storageCaptured', true)
        ->assertJsonPath('testRun', null);

    Http::assertNothingSent();

    $dir = $this->projectsPath."/{$slug}";
    expect(json_decode(File::get($dir.'/storage-state.json'), true))
        ->toBe(['cookies' => [['name' => 'sess', 'value' => 'abc']], 'origins' => []])
        ->and(File::exists($dir.'/.env'))->toBeFalse();
});

it('counts a localStorage-only recorded session as captured too', function () {
    AuthRecordingWriter::fake();
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'storageState' => ['cookies' => [], 'origins' => [['origin' => 'https://sistema.test', 'localStorage' => [['name' => 'token', 'value' => 'abc']]]]],
    ]))->assertOk()->assertJsonPath('storageCaptured', true);

    expect(File::exists($this->projectsPath."/{$slug}/storage-state.json"))->toBeTrue();
});

it('does not write storage-state.json nor attempt a fallback when no session or credentials were recorded', function () {
    AuthRecordingWriter::fake();
    Http::fake();
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload([
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => null, 'label' => null, 'value' => null, 'inputType' => null],
        ],
    ]))
        ->assertOk()
        ->assertJsonPath('storageCaptured', false);

    $dir = $this->projectsPath."/{$slug}";
    expect(File::exists($dir.'/storage-state.json'))->toBeFalse()
        ->and(File::exists($dir.'/.env'))->toBeFalse();

    Http::assertNothingSent();
});

it('extracts the real username and password from the recording and verifies the script when no live session was captured', function () {
    AuthRecordingWriter::fake([['authSetup' => "import { test as setup } from '@playwright/test' // login gravado"]]);
    fakeSuccessfulFallback();
    $slug = recordProject();

    $response = postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())
        ->assertOk()
        ->assertJsonPath('storageCaptured', true)
        ->assertJsonPath('testRun.passed', true)
        ->assertJsonPath('testRun.attempts', 1);

    expect($response->getContent())->not->toContain('topsecret123');

    $dir = $this->projectsPath."/{$slug}";
    expect(File::get($dir.'/.env'))->toContain('AUTH_USER=user1')->toContain('AUTH_PASSWORD=topsecret123');

    Http::assertSent(function ($request) {
        if (! str_contains($request->url(), '/runner/spec')) {
            return true;
        }

        return $request['env']['AUTH_USER'] === 'user1' && $request['env']['AUTH_PASSWORD'] === 'topsecret123';
    });
});

it('retries the recorded auth setup in the background when the first execution attempt fails', function () {
    AuthRecordingWriter::fake([['authSetup' => "import { test as setup } from '@playwright/test' // login gravado"]]);
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::sequence()
            ->push(['passed' => false, 'output' => 'Error: timeout no seletor #login'])
            ->push(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [['name' => 'sess']]]]),
    ]);
    AuthSetupWriter::fake([['authSetup' => 'corrigido']]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())
        ->assertOk()
        ->assertJsonPath('testRun.attempts', 1)
        ->assertJsonPath('testRun.passed', false);

    expect(File::get($this->projectsPath."/{$slug}/tests/auth.setup.ts"))->toContain('corrigido');
});

it('gives up after exhausting the background retries and keeps the recorded script on disk', function () {
    AuthRecordingWriter::fake([['authSetup' => "import { test as setup } from '@playwright/test' // login gravado"]]);
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::response(['passed' => false, 'output' => 'Error: sempre falha']),
    ]);
    AuthSetupWriter::fake([['authSetup' => 'b'], ['authSetup' => 'c']]);
    $slug = recordProject();

    postJson("/api/v1/projects/{$slug}/auth/record", recordPayload())
        ->assertOk()
        ->assertJsonPath('testRun.passed', false);

    expect(File::get($this->projectsPath."/{$slug}/tests/auth.setup.ts"))->toContain('login gravado');
});
