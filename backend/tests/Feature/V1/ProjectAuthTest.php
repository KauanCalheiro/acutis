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

function makeProject(string $name = 'Portal Sistema'): string
{
    postJson('/api/v1/projects/create/template', ['name' => $name])->assertCreated();

    return \Illuminate\Support\Str::slug($name);
}

function fakeAuthPipeline(string $authSetup = "import { test as setup } from '@playwright/test'"): void
{
    Http::fake([
        '*/runner/snapshot' => Http::response([
            'url' => 'https://sistema.test/login', 'title' => 'Login', 'elements' => [
                ['tag' => 'input', 'testId' => 'login-user', 'selector' => '[data-testid="login-user"]', 'visible' => true],
                ['tag' => 'button', 'testId' => 'login-submit', 'selector' => '[data-testid="login-submit"]', 'visible' => true],
            ],
        ]),
        '*/runner/spec' => Http::response(['passed' => true, 'output' => '1 passed', 'storageState' => ['cookies' => [['name' => 'sess']]]]),
    ]);
    AuthSetupWriter::fake([['authSetup' => $authSetup]]);
}

function authPayload(array $overrides = []): array
{
    return array_merge([
        'loginUrl' => 'https://sistema.test/login',
        'executionUrl' => 'https://sistema.test',
        'username' => 'user1',
        'password' => 'secret-xyz',
    ], $overrides);
}

it('writes the generated auth setup into the project folder', function () {
    fakeAuthPipeline("import { test as setup } from '@playwright/test' // login gerado");
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", authPayload())
        ->assertOk()
        ->assertJsonPath('testRun.passed', true)
        ->assertJsonPath('storageCaptured', true);

    $dir = $this->projectsPath."/{$slug}";

    expect(File::get($dir.'/tests/auth.setup.ts'))->toContain('login gerado')
        ->and(File::get($dir.'/playwright.config.ts'))->toContain("baseURL: 'https://sistema.test'")
        ->and(File::get($dir.'/.env'))->toContain('AUTH_USER=user1')->toContain('AUTH_PASSWORD=secret-xyz')
        ->and(File::get($dir.'/.gitignore'))->toContain('storage-state.json')->toContain('.env');
});

it('returns 404 for a project that does not exist', function () {
    fakeAuthPipeline();

    postJson('/api/v1/projects/inexistente/auth', authPayload())->assertNotFound();
});

it('shows the login page snapshot to the auth writer', function () {
    fakeAuthPipeline();
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", authPayload())->assertOk();

    AuthSetupWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'login-submit')
            && str_contains($prompt->prompt, 'https://sistema.test/login')
    );
});

it('injects credentials as env and never writes them into the setup file', function () {
    fakeAuthPipeline('process.env.AUTH_USER');
    $slug = makeProject();

    $response = postJson("/api/v1/projects/{$slug}/auth", authPayload(['password' => 'topsecret123']))->assertOk();

    expect($response->getContent())->not->toContain('topsecret123');
    expect(File::get($this->projectsPath."/{$slug}/tests/auth.setup.ts"))->not->toContain('topsecret123');

    Http::assertSent(function ($request) {
        if (! str_contains($request->url(), '/runner/spec')) {
            return true;
        }

        return $request['env']['AUTH_USER'] === 'user1' && $request['env']['AUTH_PASSWORD'] === 'topsecret123';
    });
});

it('returns the first attempt right away and retries in the background', function () {
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::sequence()
            ->push(['passed' => false, 'output' => 'Error: timeout no seletor #login'])
            ->push(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [['name' => 'sess']]]]),
    ]);
    AuthSetupWriter::fake([['authSetup' => 'primeiro'], ['authSetup' => 'corrigido']]);
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", authPayload())
        ->assertOk()
        ->assertJsonPath('testRun.attempts', 1)
        ->assertJsonPath('testRun.passed', false);

    // dispatch(...)->afterResponse() runs once the kernel terminates the request, which
    // Laravel's test HTTP client already does inside postJson() — so by now the background
    // retry has finished and the corrected setup should already be on disk.
    expect(File::get($this->projectsPath."/{$slug}/tests/auth.setup.ts"))->toContain('corrigido');

    AuthSetupWriter::assertPrompted(fn ($prompt) => str_contains($prompt->prompt, 'timeout no seletor #login'));
});

it('does not retry in the background once the first attempt already passed', function () {
    fakeAuthPipeline();
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", authPayload())
        ->assertOk()
        ->assertJsonPath('testRun.attempts', 1)
        ->assertJsonPath('testRun.passed', true);

    AuthSetupWriter::assertNotPrompted(fn ($prompt) => str_contains($prompt->prompt, 'não autenticou'));
});

it('gives up after exhausting the background retries and keeps the first attempted setup on disk', function () {
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::response(['passed' => false, 'output' => 'Error: sempre falha']),
    ]);
    AuthSetupWriter::fake([['authSetup' => 'a'], ['authSetup' => 'b'], ['authSetup' => 'c']]);
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", authPayload())
        ->assertOk()
        ->assertJsonPath('testRun.attempts', 1)
        ->assertJsonPath('testRun.passed', false);

    // background gave up after 3 total attempts (1 sync + 2 background) without ever passing,
    // so the project keeps the first attempt's setup on disk instead of a half-corrected one.
    expect(File::get($this->projectsPath."/{$slug}/tests/auth.setup.ts"))->toContain('a');
    AuthSetupWriter::assertPrompted(fn ($prompt) => str_contains($prompt->prompt, 'sempre falha'));
});

it('adds a specific hint when the failure is a strict mode violation', function () {
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::sequence()
            ->push(['passed' => false, 'output' => "Error: strict mode violation: locator('button') resolved to 4 elements"])
            ->push(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [['name' => 'sess']]]]),
    ]);
    AuthSetupWriter::fake([['authSetup' => 'primeiro'], ['authSetup' => 'corrigido']]);
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", authPayload())->assertOk();

    AuthSetupWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'strict mode violation')
            && str_contains($prompt->prompt, 'exact: true')
    );
});

it('reports an empty session as not captured', function () {
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [], 'origins' => []]]),
    ]);
    AuthSetupWriter::fake([['authSetup' => 'a'], ['authSetup' => 'b'], ['authSetup' => 'c']]);
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", authPayload())
        ->assertOk()
        ->assertJsonPath('storageCaptured', false)
        ->assertJsonPath('testRun.passed', false);
});

it('counts a localStorage-only session as captured', function () {
    Http::fake([
        '*/runner/snapshot' => Http::response(['url' => 'x', 'title' => 'x', 'elements' => []]),
        '*/runner/spec' => Http::response([
            'passed' => true, 'output' => 'ok',
            'storageState' => ['cookies' => [], 'origins' => [['origin' => 'https://x.test', 'localStorage' => [['name' => 'token', 'value' => 'abc']]]]],
        ]),
    ]);
    AuthSetupWriter::fake([['authSetup' => 'login via token']]);
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", authPayload())
        ->assertOk()
        ->assertJsonPath('storageCaptured', true)
        ->assertJsonPath('testRun.passed', true);
});

it('validates login url and credentials', function () {
    AuthSetupWriter::fake();
    Http::fake();
    $slug = makeProject();

    postJson("/api/v1/projects/{$slug}/auth", ['loginUrl' => 'not-a-url'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['loginUrl', 'username', 'password']);
});
