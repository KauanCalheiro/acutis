<?php

use App\Enums\EnvKey;
use App\Support\Project;
use Illuminate\Support\Facades\File;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

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

    $this->dotenv = fn (): string => File::exists($this->dir.'/.env') ? File::get($this->dir.'/.env') : '';
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('lists the variables of the env file', function () {
    File::put($this->dir.'/.env', "BASE_URL=https://loja.test\nCUPOM_VALIDO=ABC\n");

    getJson('/api/v1/projects/minha-loja/env')
        ->assertOk()
        ->assertJsonPath('vars.0', ['key' => 'BASE_URL', 'value' => 'https://loja.test', 'secret' => false, 'pending' => false])
        ->assertJsonPath('vars.1.key', 'CUPOM_VALIDO');
});

it('lists nothing when the project has no env file', function () {
    getJson('/api/v1/projects/minha-loja/env')->assertOk()->assertJsonPath('vars', []);
});

it('hides the value of a key a secret points to', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => 'segredo', 'secret' => true]],
    ])->assertOk();

    $response = getJson('/api/v1/projects/minha-loja/env')->assertOk();

    expect(collect($response->json('vars'))->firstWhere('key', 'HOMOLOG_AUTH_PASSWORD'))
        ->toMatchArray(['value' => null, 'secret' => true, 'pending' => false])
        ->and($response->content())->not->toContain('segredo');
});

it('shows a key a secret points to but nobody filled yet', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => '{{env.SENHA_HOMOLOG}}', 'secret' => true]],
    ])->assertOk();

    expect(collect(getJson('/api/v1/projects/minha-loja/env')->assertOk()->json('vars'))->firstWhere('key', 'SENHA_HOMOLOG'))
        ->toMatchArray(['value' => null, 'secret' => true, 'pending' => true]);
});

it('never lists the active environment as an editable variable', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    expect(collect(getJson('/api/v1/projects/minha-loja/env')->assertOk()->json('vars'))->pluck('key'))
        ->not->toContain('ACUTIS_ENV');
});

it('writes the value straight into the file', function () {
    File::put($this->dir.'/.env', "BASE_URL=https://loja.test\n");

    putJson('/api/v1/projects/minha-loja/env', [
        'vars' => [
            ['key' => 'BASE_URL', 'value' => 'https://outra.test'],
            ['key' => 'CUPOM_VALIDO', 'value' => 'ABC'],
        ],
    ])->assertOk();

    expect(($this->dotenv)())
        ->toContain('BASE_URL=https://outra.test')
        ->toContain('CUPOM_VALIDO=ABC')
        ->not->toContain('loja.test');
});

it('removes a variable the editor dropped', function () {
    File::put($this->dir.'/.env', "BASE_URL=https://loja.test\nCUPOM_VALIDO=ABC\n");

    putJson('/api/v1/projects/minha-loja/env', [
        'vars' => [['key' => 'BASE_URL', 'value' => 'https://loja.test']],
    ])->assertOk();

    expect(($this->dotenv)())->not->toContain('CUPOM_VALIDO');
});

it('keeps the active environment even though the editor never sees it', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/env', [
        'vars' => [['key' => 'BASE_URL', 'value' => 'https://loja.test']],
    ])->assertOk();

    expect(($this->dotenv)())->toContain('ACUTIS_ENV=homolog');
});

it('keeps a secret the editor saved back empty', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => 'segredo', 'secret' => true]],
    ])->assertOk();

    putJson('/api/v1/projects/minha-loja/env', [
        'vars' => [['key' => 'HOMOLOG_AUTH_PASSWORD', 'value' => null]],
    ])->assertOk();

    expect(($this->dotenv)())->toContain('HOMOLOG_AUTH_PASSWORD=segredo');
});

it('fills a secret that was still pending', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => '{{env.SENHA_HOMOLOG}}', 'secret' => true]],
    ])->assertOk();

    putJson('/api/v1/projects/minha-loja/env', [
        'vars' => [['key' => 'SENHA_HOMOLOG', 'value' => 'segredo']],
    ])->assertOk();

    expect(($this->dotenv)())->toContain('SENHA_HOMOLOG=segredo');

    getJson('/api/v1/projects/minha-loja/environments')
        ->assertOk()
        ->assertJsonPath('environments.0.vars.0.pending', false);
});

it('keeps the env file out of git', function () {
    putJson('/api/v1/projects/minha-loja/env', [
        'vars' => [['key' => 'BASE_URL', 'value' => 'https://loja.test']],
    ])->assertOk();

    expect(File::get($this->dir.'/.gitignore'))->toContain('.env');
});

it('validates the variable keys', function () {
    putJson('/api/v1/projects/minha-loja/env', [
        'vars' => [['key' => 'chave invalida', 'value' => 'x']],
    ])->assertStatus(422)->assertJsonValidationErrors(['vars.0.key']);
});

it('returns 404 for a project that does not exist', function () {
    getJson('/api/v1/projects/nao-existe/env')->assertNotFound();
    putJson('/api/v1/projects/nao-existe/env', ['vars' => []])->assertNotFound();
});

it('falls back to the default only when the key is not in the file', function () {
    File::put($this->dir.'/.env', "BASE_URL=https://loja.test\n");

    $env = Project::make('minha-loja')->env();

    expect($env->get(EnvKey::AUTH_USER))->toBeNull()
        ->and($env->get(EnvKey::AUTH_USER, 'ninguem'))->toBe('ninguem')
        ->and($env->get(EnvKey::BASE_URL, 'https://padrao.test'))->toBe('https://loja.test');
});

it('falls back to the default when the active environment leaves the key empty', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'BASE_URL', 'value' => '{{env.URL_QUE_NINGUEM_PREENCHEU}}']],
    ])->assertOk();

    $environments = Project::make('minha-loja')->environments();

    expect($environments->value(EnvKey::BASE_URL))->toBeNull()
        ->and($environments->value(EnvKey::BASE_URL, 'https://padrao.test'))->toBe('https://padrao.test');
});
