<?php

use App\Ai\Agents\AuthSetupWriter;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function fakeAuthPipeline(string $authSetup = "import { test as setup } from '@playwright/test'"): void
{
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'https://sistema.test/login', 'title' => 'Login', 'elements' => []]),
        '*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [['name' => 'sess']]]]),
    ]);
    AuthSetupWriter::fake([['authSetup' => $authSetup]]);
}

function authProjectPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Portal Sistema',
        'loginUrl' => 'https://sistema.test/login',
        'executionUrl' => 'https://sistema.test',
        'username' => 'user1',
        'password' => 'secret-xyz',
    ], $overrides);
}

it('creates an authenticated project holding the generated auth setup', function () {
    fakeAuthPipeline("import { test as setup } from '@playwright/test' // login gerado");

    postJson('/api/v1/projects/create/auth', authProjectPayload())
        ->assertCreated()
        ->assertJsonPath('project.slug', 'portal-sistema')
        ->assertJsonPath('project.path', $this->projectsPath.'/portal-sistema')
        ->assertJsonPath('testRun.passed', true)
        ->assertJsonPath('storageCaptured', true);

    $dir = $this->projectsPath.'/portal-sistema';

    expect(File::get($dir.'/tests/auth.setup.ts'))->toContain('login gerado')
        ->and(File::exists($dir.'/playwright.config.ts'))->toBeTrue()
        ->and(File::exists($dir.'/tests/navegacao.spec.ts'))->toBeTrue()
        ->and(File::exists($dir.'/acutis.json'))->toBeTrue();
});

it('writes credentials to .env and gitignores the session state', function () {
    fakeAuthPipeline();

    postJson('/api/v1/projects/create/auth', authProjectPayload())->assertCreated();

    $dir = $this->projectsPath.'/portal-sistema';

    expect(File::get($dir.'/.env'))->toContain('AUTH_USER=user1')->toContain('AUTH_PASSWORD=secret-xyz');
    expect(File::get($dir.'/.gitignore'))->toContain('storage-state.json')->toContain('.env');
    expect(File::get($dir.'/tests/auth.setup.ts'))->not->toContain('secret-xyz');
});

it('does not leak the password in the api response', function () {
    fakeAuthPipeline();

    $response = postJson('/api/v1/projects/create/auth', authProjectPayload(['password' => 'topsecret123']))->assertCreated();

    expect($response->getContent())->not->toContain('topsecret123');
});

it('bakes the execution url into the playwright config', function () {
    fakeAuthPipeline();

    postJson('/api/v1/projects/create/auth', authProjectPayload())->assertCreated();

    expect(File::get($this->projectsPath.'/portal-sistema/playwright.config.ts'))
        ->toContain("baseURL: 'https://sistema.test'")
        ->not->toContain('{{baseUrl}}');
});

it('still scaffolds the project when authentication fails, reporting the run', function () {
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::response(['passed' => false, 'output' => 'Error: login falhou']),
    ]);
    AuthSetupWriter::fake([['authSetup' => 'a'], ['authSetup' => 'b'], ['authSetup' => 'c']]);

    postJson('/api/v1/projects/create/auth', authProjectPayload())
        ->assertCreated()
        ->assertJsonPath('storageCaptured', false)
        ->assertJsonPath('testRun.passed', false);

    expect(File::exists($this->projectsPath.'/portal-sistema/tests/auth.setup.ts'))->toBeTrue();
});

it('requires name, loginUrl and credentials', function () {
    AuthSetupWriter::fake();
    Http::fake();

    postJson('/api/v1/projects/create/auth', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'loginUrl', 'username', 'password']);
});

it('rejects a duplicate project', function () {
    File::ensureDirectoryExists($this->projectsPath.'/portal-sistema');
    AuthSetupWriter::fake();
    Http::fake();

    postJson('/api/v1/projects/create/auth', authProjectPayload())
        ->assertStatus(422)
        ->assertJsonValidationErrors('name');
});
