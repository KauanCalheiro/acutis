<?php

use App\Ai\Agents\AuthSetupWriter;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\postJson;

function authPayload(array $overrides = []): array
{
    return array_merge([
        'loginUrl' => 'https://sistema.test/login',
        'executionUrl' => 'https://sistema.test',
        'username' => '733787',
        'password' => 'segredo-forte',
    ], $overrides);
}

function fakeSnapshot(): void
{
    Http::fake([
        '*/runner/snapshot' => Http::response([
            'url' => 'https://sistema.test/login',
            'title' => 'Login',
            'elements' => [
                ['tag' => 'input', 'type' => 'text', 'id' => 'user', 'name' => 'user', 'testId' => 'login-user', 'placeholder' => 'Usuário', 'ariaLabel' => null, 'text' => null],
                ['tag' => 'input', 'type' => 'password', 'id' => 'pass', 'name' => 'pass', 'testId' => 'login-pass', 'placeholder' => 'Senha', 'ariaLabel' => null, 'text' => null],
                ['tag' => 'button', 'type' => 'submit', 'id' => null, 'name' => null, 'testId' => 'login-submit', 'placeholder' => null, 'ariaLabel' => null, 'text' => 'Entrar'],
            ],
        ]),
    ]);
}

it('generates an auth setup and reports a passing run with captured state', function () {
    AuthSetupWriter::fake([['authSetup' => "import { test } from '@playwright/test'"]]);
    Http::fake([
        '*/runner/snapshot' => Http::response([
            'url' => 'https://sistema.test/login', 'title' => 'Login', 'elements' => [],
        ]),
        '*/runner/spec' => Http::response(['passed' => true, 'output' => '1 passed', 'storageState' => ['cookies' => [['name' => 'sess']]]]),
    ]);

    postJson('/api/v1/auth-setups', authPayload())
        ->assertOk()
        ->assertJson([
            'authSetup' => "import { test } from '@playwright/test'",
            'testRun' => ['executed' => true, 'passed' => true, 'attempts' => 1, 'error' => null],
            'storageCaptured' => true,
        ]);
});

it('shows the login page snapshot to the auth writer', function () {
    fakeSnapshot();
    Http::fake(['*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => []]])]);
    AuthSetupWriter::fake([['authSetup' => 'setup']]);

    postJson('/api/v1/auth-setups', authPayload())->assertOk();

    AuthSetupWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'login-submit')
            && str_contains($prompt->prompt, 'https://sistema.test/login')
    );
});

it('injects the credentials as env into the runner without leaking them in the setup', function () {
    fakeSnapshot();
    Http::fake(['*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => []]])]);
    AuthSetupWriter::fake([['authSetup' => 'process.env.AUTH_USER']]);

    postJson('/api/v1/auth-setups', authPayload())->assertOk();

    Http::assertSent(function ($request) {
        if (! str_contains($request->url(), '/runner/spec')) {
            return true;
        }

        return $request['env']['AUTH_USER'] === '733787'
            && $request['env']['AUTH_PASSWORD'] === 'segredo-forte'
            && ! str_contains((string) $request['spec'], 'segredo-forte');
    });
});

it('treats a passing run with empty session state as not authenticated and retries', function () {
    fakeSnapshot();
    AuthSetupWriter::fake([
        ['authSetup' => 'atalho que não loga'],
        ['authSetup' => 'login de verdade'],
    ]);
    Http::fake([
        '*/runner/spec' => Http::sequence()
            ->push(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [], 'origins' => []]])
            ->push(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [['name' => 'session']], 'origins' => []]]),
    ]);

    postJson('/api/v1/auth-setups', authPayload())
        ->assertOk()
        ->assertJson([
            'authSetup' => 'login de verdade',
            'testRun' => ['executed' => true, 'passed' => true, 'attempts' => 2],
            'storageCaptured' => true,
        ]);

    AuthSetupWriter::assertPrompted(fn ($prompt) => str_contains($prompt->prompt, 'sessão'));
});

it('counts localStorage-only session state as captured', function () {
    fakeSnapshot();
    AuthSetupWriter::fake([['authSetup' => 'login via token']]);
    Http::fake(['*/runner/spec' => Http::response([
        'passed' => true, 'output' => 'ok',
        'storageState' => ['cookies' => [], 'origins' => [['origin' => 'https://x.test', 'localStorage' => [['name' => 'token', 'value' => 'abc']]]]],
    ])]);

    postJson('/api/v1/auth-setups', authPayload())
        ->assertOk()
        ->assertJson(['storageCaptured' => true, 'testRun' => ['passed' => true]]);
});

it('reports empty session after all attempts as not captured and not passed', function () {
    fakeSnapshot();
    AuthSetupWriter::fake([['authSetup' => 'a'], ['authSetup' => 'b'], ['authSetup' => 'c']]);
    Http::fake(['*/runner/spec' => Http::response(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [], 'origins' => []]])]);

    postJson('/api/v1/auth-setups', authPayload())
        ->assertOk()
        ->assertJson([
            'testRun' => ['executed' => true, 'passed' => false, 'attempts' => 3],
            'storageCaptured' => false,
        ]);
});

it('feeds the runner failure back to the auth writer and retries', function () {
    fakeSnapshot();
    AuthSetupWriter::fake([
        ['authSetup' => 'primeiro setup'],
        ['authSetup' => 'setup corrigido'],
    ]);
    Http::fake([
        '*/runner/spec' => Http::sequence()
            ->push(['passed' => false, 'output' => 'Error: timeout no seletor #login'])
            ->push(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => [['name' => 'session']]]]),
    ]);

    postJson('/api/v1/auth-setups', authPayload())
        ->assertOk()
        ->assertJson([
            'authSetup' => 'setup corrigido',
            'testRun' => ['executed' => true, 'passed' => true, 'attempts' => 2],
            'storageCaptured' => true,
        ]);

    AuthSetupWriter::assertPrompted(
        fn ($prompt) => str_contains($prompt->prompt, 'Error: timeout no seletor #login')
            && str_contains($prompt->prompt, 'primeiro setup')
    );
});

it('reports a run that never captured state as not captured', function () {
    fakeSnapshot();
    AuthSetupWriter::fake([
        ['authSetup' => 'a'], ['authSetup' => 'b'], ['authSetup' => 'c'],
    ]);
    Http::fake(['*/runner/spec' => Http::response(['passed' => false, 'output' => 'Error: login falhou'])]);

    postJson('/api/v1/auth-setups', authPayload())
        ->assertOk()
        ->assertJson([
            'testRun' => ['executed' => true, 'passed' => false, 'attempts' => 3, 'error' => 'Error: login falhou'],
            'storageCaptured' => false,
        ]);
});

it('rejects an invalid login url', function () {
    AuthSetupWriter::fake();
    Http::fake();

    postJson('/api/v1/auth-setups', authPayload(['loginUrl' => 'not-a-url']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['loginUrl']);
});

it('rejects missing credentials', function () {
    AuthSetupWriter::fake();
    Http::fake();

    $payload = authPayload();
    unset($payload['username'], $payload['password']);

    postJson('/api/v1/auth-setups', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['username', 'password']);
});
