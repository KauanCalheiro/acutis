<?php

use Illuminate\Support\Facades\File;

use function Pest\Laravel\patchJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    $this->dir = $this->projectsPath.'/minha-loja';
    File::ensureDirectoryExists($this->dir);
    File::put($this->dir.'/acutis.json', json_encode([
        'name' => 'Minha Loja',
        'slug' => 'minha-loja',
        'created_at' => '2026-01-01T00:00:00+00:00',
        'version' => 1,
    ]));
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function updatePayload(array $overrides = []): array
{
    return array_merge([
        'title' => 'Login atualizado',
        'path' => 'login',
        'domain' => '',
        'gherkin' => "Funcionalidade: Login\n  Cenário: entra",
        'playwright' => "test.describe('Login', () => {})",
        'tags' => ['@read'],
    ], $overrides);
}

it('updates the scenario in place when domain/path stay the same', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::ensureDirectoryExists($this->dir.'/features');
    File::put($this->dir.'/tests/login.spec.ts', "test.describe('Login', () => {})");
    File::put($this->dir.'/features/login.feature', 'Funcionalidade: Login');

    patchJson('/api/v1/projects/minha-loja/scenarios/login', updatePayload())
        ->assertOk()
        ->assertJsonPath('spec', 'tests/login.spec.ts')
        ->assertJsonPath('title', 'Login atualizado')
        ->assertJsonPath('tags', ['@read']);

    expect(File::get($this->dir.'/features/login.feature'))->toContain('Funcionalidade: Login atualizado');
    expect(File::get($this->dir.'/tests/login.spec.ts'))->toContain('@read');
});

it('renames the scenario files and moves the persisted events', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::ensureDirectoryExists($this->dir.'/features');
    File::put($this->dir.'/tests/login.spec.ts', "test.describe('Login', () => {})");
    File::put($this->dir.'/features/login.feature', 'Funcionalidade: Login');
    File::put($this->dir.'/tests/login.events.json', '[{"type":"click"}]');

    patchJson('/api/v1/projects/minha-loja/scenarios/login', updatePayload(['path' => 'entrar', 'domain' => 'auth']))
        ->assertOk()
        ->assertJsonPath('spec', 'tests/auth/entrar.spec.ts')
        ->assertJsonPath('domain', 'auth');

    expect(File::exists($this->dir.'/tests/login.spec.ts'))->toBeFalse();
    expect(File::exists($this->dir.'/features/login.feature'))->toBeFalse();
    expect(File::exists($this->dir.'/tests/login.events.json'))->toBeFalse();

    expect(File::exists($this->dir.'/tests/auth/entrar.spec.ts'))->toBeTrue();
    expect(File::exists($this->dir.'/features/auth/entrar.feature'))->toBeTrue();
    expect(File::get($this->dir.'/tests/auth/entrar.events.json'))->toBe('[{"type":"click"}]');
});

it('refuses a title or a path longer than a file name can hold', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/login.spec.ts', "test.describe('Login', () => {})");

    patchJson('/api/v1/projects/minha-loja/scenarios/login', updatePayload([
        'title' => str_repeat('cenário ', 40),
        'path' => str_repeat('caminho-', 20),
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title', 'path']);
});

it('rejects renaming onto a scenario that already exists', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/login.spec.ts', "test.describe('Login', () => {})");
    File::put($this->dir.'/tests/cadastro.spec.ts', "test.describe('Cadastro', () => {})");

    patchJson('/api/v1/projects/minha-loja/scenarios/login', updatePayload(['path' => 'cadastro']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('path');

    expect(File::exists($this->dir.'/tests/login.spec.ts'))->toBeTrue();
});

it('edits the auth setup without ever moving its files', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::ensureDirectoryExists($this->dir.'/features');
    File::put($this->dir.'/tests/auth.setup.ts', "setup('entrar', async () => {})");
    File::put($this->dir.'/features/auth.feature', 'Funcionalidade: Entrar');

    patchJson('/api/v1/projects/minha-loja/scenarios/auth', updatePayload([
        'title' => 'Entrar na plataforma',
        'path' => 'entrar-na-plataforma',
        'domain' => 'acesso',
        'playwright' => "setup('entrar', async () => { await page.goto('/') })",
        'tags' => [],
    ]))
        ->assertOk()
        ->assertJsonPath('spec', 'tests/auth.setup.ts')
        ->assertJsonPath('feature', 'features/auth.feature')
        ->assertJsonPath('is_auth', true)
        ->assertJsonPath('title', 'Entrar na plataforma');

    expect(File::exists($this->dir.'/tests/auth.setup.ts'))->toBeTrue();
    expect(File::exists($this->dir.'/tests/acesso/entrar-na-plataforma.spec.ts'))->toBeFalse();
    expect(File::get($this->dir.'/tests/auth.setup.ts'))->toContain("await page.goto('/')");
    expect(File::get($this->dir.'/features/auth.feature'))->toContain('Funcionalidade: Entrar na plataforma');
});

it('writes the auth feature on the first edit of a setup without one', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', "setup('entrar', async () => {})");

    patchJson('/api/v1/projects/minha-loja/scenarios/auth', updatePayload(['title' => 'Entrar', 'tags' => []]))
        ->assertOk()
        ->assertJsonPath('feature', 'features/auth.feature');

    expect(File::get($this->dir.'/features/auth.feature'))->toContain('Funcionalidade: Entrar');
});

it('returns 404 for an unknown scenario', function () {
    File::ensureDirectoryExists($this->dir.'/tests');

    patchJson('/api/v1/projects/minha-loja/scenarios/nao-existe', updatePayload())->assertNotFound();
});

it('returns 404 for an unknown project', function () {
    patchJson('/api/v1/projects/nao-existe/scenarios/login', updatePayload())->assertNotFound();
});
