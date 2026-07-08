<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function project(string $name = 'Portal Sistema'): string
{
    postJson('/api/v1/projects/create/template', ['name' => $name])->assertCreated();

    return Str::slug($name);
}

function writePayload(array $overrides = []): array
{
    return array_merge([
        'title' => 'Login do cliente',
        'tags' => ['@read', '@login'],
        'domain' => 'login',
        'path' => 'login-do-cliente',
        'gherkin' => "@rascunho\nFuncionalidade: Rascunho antigo\n  Cenário: entra",
        'playwright' => <<<'TS'
        import { test, expect } from '@playwright/test'

        test.describe('Login', () => {
            test('entra', async ({ page }) => {})
        })
        TS,
    ], $overrides);
}

it('writes the edited draft into a domain folder at the given path', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload())
        ->assertOk()
        ->assertJsonPath('spec', 'tests/login/login-do-cliente.spec.ts')
        ->assertJsonPath('feature', 'features/login/login-do-cliente.feature');

    $dir = $this->projectsPath."/{$slug}";

    expect(File::exists($dir.'/tests/login/login-do-cliente.spec.ts'))->toBeTrue()
        ->and(File::exists($dir.'/features/login/login-do-cliente.feature'))->toBeTrue();
});

it('stamps the edited title and tags so the artifacts reflect the form fields', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload())->assertOk();

    $dir = $this->projectsPath."/{$slug}";
    $feature = File::get($dir.'/features/login/login-do-cliente.feature');
    $spec = File::get($dir.'/tests/login/login-do-cliente.spec.ts');

    expect($feature)->toContain('Funcionalidade: Login do cliente')
        ->not->toContain('Rascunho antigo')
        ->and($feature)->toContain('@read @login')
        ->and($spec)->toContain("tag: ['@read', '@login']");
});

it('lists the written scenario with the edited title, tags and domain', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload())->assertOk();

    $scenarios = getJson("/api/v1/projects/{$slug}")->assertOk()->json('scenarios');
    $ours = collect($scenarios)->firstWhere('title', 'Login do cliente');

    expect($ours)->not->toBeNull()
        ->and($ours['tags'])->toBe(['@read', '@login'])
        ->and($ours['domain'])->toBe('login');
});

it('avoids overwriting an existing spec at the same path within the domain', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload())
        ->assertOk()
        ->assertJsonPath('spec', 'tests/login/login-do-cliente.spec.ts');

    postJson("/api/v1/projects/{$slug}/tests", writePayload())
        ->assertOk()
        ->assertJsonPath('spec', 'tests/login/login-do-cliente-2.spec.ts');
});

it('returns 404 for a project that does not exist', function () {
    postJson('/api/v1/projects/inexistente/tests', writePayload())->assertNotFound();
});

it('validates the write payload', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", ['tags' => 'nope'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['title', 'path', 'domain', 'gherkin', 'playwright']);
});
