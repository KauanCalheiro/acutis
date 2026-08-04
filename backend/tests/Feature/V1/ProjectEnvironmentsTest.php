<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\deleteJson;
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

    $this->environment = fn (string $slug): array => json_decode(File::get("{$this->dir}/environments/{$slug}.json"), true);
    $this->dotenv = fn (): string => File::exists($this->dir.'/.env') ? File::get($this->dir.'/.env') : '';
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('lists no environments on a project that never created one', function () {
    getJson('/api/v1/projects/minha-loja/environments')
        ->assertOk()
        ->assertJsonPath('active', null)
        ->assertJsonPath('environments', []);
});

it('creates an environment and slugs its name', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homologação'])
        ->assertCreated()
        ->assertJsonPath('slug', 'homologacao')
        ->assertJsonPath('name', 'Homologação');

    expect(($this->environment)('homologacao'))->toMatchArray(['name' => 'Homologação', 'vars' => []]);
});

it('seeds the first environment with what the project already had in the env file', function () {
    File::put($this->dir.'/.env', "BASE_URL=https://loja.test\nAUTH_USER=qa@loja.test\nAUTH_PASSWORD=segredo\n");

    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Local'])->assertCreated();

    expect(($this->environment)('local')['vars'])->toBe([
        ['key' => 'BASE_URL', 'value' => 'https://loja.test', 'secret' => false],
        ['key' => 'AUTH_USER', 'value' => 'qa@loja.test', 'secret' => false],
        ['key' => 'AUTH_PASSWORD', 'value' => '{{env.AUTH_PASSWORD}}', 'secret' => true],
    ]);
});

it('seeds only the first environment', function () {
    File::put($this->dir.'/.env', "BASE_URL=https://loja.test\n");

    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Local'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Produção'])->assertCreated();

    expect(($this->environment)('producao')['vars'])->toBe([]);
});

it('activates the first environment created', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Local'])->assertCreated();

    getJson('/api/v1/projects/minha-loja/environments')->assertOk()->assertJsonPath('active', 'local');
});

it('rejects a name that collides with an existing environment', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homologação'])->assertCreated();

    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'homologacao'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

it('saves plain variables in the versioned file', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [
            ['key' => 'BASE_URL', 'value' => 'https://homolog.loja.test'],
            ['key' => 'AUTH_USER', 'value' => 'qa@loja.test'],
        ],
    ])->assertOk()->assertJsonPath('vars.0.value', 'https://homolog.loja.test');

    expect(($this->environment)('homolog')['vars'])->toBe([
        ['key' => 'BASE_URL', 'value' => 'https://homolog.loja.test', 'secret' => false],
        ['key' => 'AUTH_USER', 'value' => 'qa@loja.test', 'secret' => false],
    ]);
});

it('moves a secret value into the env file and leaves a pointer behind', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => 'segredo', 'secret' => true]],
    ])->assertOk();

    expect(($this->environment)('homolog')['vars'])
        ->toBe([['key' => 'AUTH_PASSWORD', 'value' => '{{env.HOMOLOG_AUTH_PASSWORD}}', 'secret' => true]])
        ->and(($this->dotenv)())->toContain('HOMOLOG_AUTH_PASSWORD=segredo')
        ->and(File::get($this->dir.'/.gitignore'))->toContain('.env');
});

it('keeps the pointer the user typed instead of minting a new key', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => '{{env.SENHA_COMPARTILHADA}}', 'secret' => true]],
    ])->assertOk();

    expect(($this->environment)('homolog')['vars'][0]['value'])->toBe('{{env.SENHA_COMPARTILHADA}}');
});

it('never returns the value of a secret variable', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => 'segredo', 'secret' => true]],
    ])->assertOk()->assertJsonPath('vars.0.value', null);

    $response = getJson('/api/v1/projects/minha-loja/environments')->assertOk();

    expect($response->json('environments.0.vars.0'))
        ->toMatchArray(['key' => 'AUTH_PASSWORD', 'value' => null, 'secret' => true, 'pending' => false])
        ->and($response->content())->not->toContain('segredo');
});

it('keeps the stored secret when the client saves it back without a value', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => 'segredo', 'secret' => true]],
    ])->assertOk();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => null, 'secret' => true]],
    ])->assertOk();

    expect(($this->environment)('homolog')['vars'][0]['value'])->toBe('{{env.HOMOLOG_AUTH_PASSWORD}}')
        ->and(($this->dotenv)())->toContain('HOMOLOG_AUTH_PASSWORD=segredo');
});

it('marks a variable as pending while its pointer has no value', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'AUTH_PASSWORD', 'value' => '{{env.SENHA_QUE_NINGUEM_PREENCHEU}}', 'secret' => true]],
    ])->assertOk();

    getJson('/api/v1/projects/minha-loja/environments')
        ->assertOk()
        ->assertJsonPath('environments.0.vars.0.pending', true);
});

it('offers the known keys for autocomplete', function () {
    File::put($this->dir.'/.env', "BASE_URL=https://loja.test\nCUPOM_VALIDO=ABC\n");
    File::put($this->dir.'/.env.example', "BASE_URL=\nCPF_TESTE=\n");
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    $response = getJson('/api/v1/projects/minha-loja/environments')->assertOk();

    expect($response->json('known_keys'))->toContain('BASE_URL', 'CUPOM_VALIDO', 'CPF_TESTE')
        ->and($response->json('dotenv_keys'))->toContain('BASE_URL', 'CUPOM_VALIDO')
        ->and($response->json('dotenv_keys'))->not->toContain('CPF_TESTE');
});

it('validates the variable keys', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'chave invalida', 'value' => 'x']],
    ])->assertStatus(422)->assertJsonValidationErrors(['vars.0.key']);
});

it('rejects the same key twice in one environment', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [
            ['key' => 'BASE_URL', 'value' => 'https://a.test'],
            ['key' => 'BASE_URL', 'value' => 'https://b.test'],
        ],
    ])->assertStatus(422)->assertJsonValidationErrors(['vars.1.key']);
});

it('activates another environment', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();

    postJson('/api/v1/projects/minha-loja/environments/producao/activate')
        ->assertOk()
        ->assertJsonPath('slug', 'producao');

    expect(($this->dotenv)())->toContain('ACUTIS_ENV=producao');
});

it('falls back to the first environment when the active one no longer exists', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();
    File::put($this->dir.'/.env', "ACUTIS_ENV=apagado\n");

    getJson('/api/v1/projects/minha-loja/environments')->assertOk()->assertJsonPath('active', 'homolog');
});

it('deletes an environment and forgets it was the active one', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments/producao/activate')->assertOk();

    deleteJson('/api/v1/projects/minha-loja/environments/producao')->assertNoContent();

    expect(File::exists($this->dir.'/environments/producao.json'))->toBeFalse()
        ->and(($this->dotenv)())->not->toContain('ACUTIS_ENV=producao');

    getJson('/api/v1/projects/minha-loja/environments')->assertOk()->assertJsonPath('active', 'homolog');
});

it('returns 404 for an environment that does not exist', function () {
    putJson('/api/v1/projects/minha-loja/environments/inexistente', ['name' => 'X', 'vars' => []])->assertNotFound();
    deleteJson('/api/v1/projects/minha-loja/environments/inexistente')->assertNotFound();
    postJson('/api/v1/projects/minha-loja/environments/inexistente/activate')->assertNotFound();
});

it('returns 404 for a project that does not exist', function () {
    getJson('/api/v1/projects/nao-existe/environments')->assertNotFound();
});

it('saves the base url into the active environment', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/settings', ['baseUrl' => 'https://homolog.loja.test'])->assertOk();

    expect(($this->environment)('homolog')['vars'])
        ->toBe([['key' => 'BASE_URL', 'value' => 'https://homolog.loja.test', 'secret' => false]]);

    getJson('/api/v1/projects/minha-loja')->assertOk()->assertJsonPath('base_url', 'https://homolog.loja.test');
});

it('shows the base url of whichever environment is active', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/settings', ['baseUrl' => 'https://homolog.loja.test'])->assertOk();

    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments/producao/activate')->assertOk();
    putJson('/api/v1/projects/minha-loja/settings', ['baseUrl' => 'https://loja.test'])->assertOk();

    getJson('/api/v1/projects/minha-loja')->assertOk()->assertJsonPath('base_url', 'https://loja.test');
});

it('keeps the password of the active environment out of the versioned file', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    postJson('/api/v1/projects/minha-loja/auth/credentials', [
        'username' => 'qa@loja.test',
        'password' => 'segredo',
    ])->assertNoContent();

    expect(($this->environment)('homolog')['vars'])->toBe([
        ['key' => 'AUTH_USER', 'value' => 'qa@loja.test', 'secret' => false],
        ['key' => 'AUTH_PASSWORD', 'value' => '{{env.HOMOLOG_AUTH_PASSWORD}}', 'secret' => true],
    ])->and(($this->dotenv)())->toContain('HOMOLOG_AUTH_PASSWORD=segredo');
});

it('shows which environment the project is on', function () {
    getJson('/api/v1/projects/minha-loja')->assertOk()->assertJsonPath('environment', null);

    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homologação'])->assertCreated();

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('environment.slug', 'homologacao')
        ->assertJsonPath('environment.name', 'Homologação');
});

it('runs against the active environment', function () {
    Http::fake(['*/runner/project' => Http::response(['passed' => true, 'output' => 'ok'])]);

    File::put($this->dir.'/.env', "CUPOM_VALIDO=ABC\n");
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [
            ['key' => 'BASE_URL', 'value' => 'https://homolog.loja.test'],
            ['key' => 'AUTH_PASSWORD', 'value' => 'segredo', 'secret' => true],
        ],
    ])->assertOk();

    postJson('/api/v1/projects/minha-loja/run')->assertOk();

    Http::assertSent(fn ($request) => $request['env']['BASE_URL'] === 'https://homolog.loja.test'
        && $request['env']['AUTH_PASSWORD'] === 'segredo'
        && $request['env']['CUPOM_VALIDO'] === 'ABC'
        && $request['env']['STORAGE_STATE'] === 'storage-state.homolog.json');
});

it('sends no environment to the runner while the project has none', function () {
    Http::fake(['*/runner/project' => Http::response(['passed' => true, 'output' => 'ok'])]);

    postJson('/api/v1/projects/minha-loja/run')->assertOk();

    Http::assertSent(fn ($request) => $request['env'] === null);
});
