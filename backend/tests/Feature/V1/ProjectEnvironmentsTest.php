<?php

use App\Enums\EnvKey;
use App\Support\Project;
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

it('always has an environment, with the url as the minimum', function () {
    getJson('/api/v1/projects/minha-loja/environments')
        ->assertOk()
        ->assertJsonPath('active', 'ambiente')
        ->assertJsonPath('environments.0.name', 'Ambiente')
        ->assertJsonPath('environments.0.vars.0.key', 'URL');
});

it('requires user and password once the project has authentication', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', '// login gravado');

    expect(array_column(getJson('/api/v1/projects/minha-loja/environments')->assertOk()->json('environments.0.vars'), 'key'))
        ->toBe(['URL', 'USER', 'PASSWORD']);
});

it('marks the password as a secret when it creates it', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', '// login gravado');

    expect(collect(getJson('/api/v1/projects/minha-loja/environments')->assertOk()->json('environments.0.vars'))->firstWhere('key', 'PASSWORD'))
        ->toMatchArray(['secret' => true]);
});

it('brings a required key back when the editor drops it', function () {
    getJson('/api/v1/projects/minha-loja/environments')->assertOk();

    putJson('/api/v1/projects/minha-loja/environments/ambiente', [
        'name' => 'Ambiente',
        'vars' => [['key' => 'CUPOM_VALIDO', 'value' => 'ABC']],
    ])->assertOk();

    expect(array_column(($this->environment)('ambiente')['vars'], 'key'))->toContain('URL', 'CUPOM_VALIDO');
});

it('creates the environment when the credentials arrive before any of them', function () {
    postJson('/api/v1/projects/minha-loja/auth/credentials', [
        'username' => 'qa@loja.test',
        'password' => 'segredo',
    ])->assertNoContent();

    expect(($this->environment)('ambiente')['vars'])->toBe([
        ['key' => 'URL', 'value' => '', 'secret' => false],
        ['key' => 'USER', 'value' => 'qa@loja.test', 'secret' => false],
        ['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true],
    ]);
});

it('creates an environment and slugs its name', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homologação'])
        ->assertCreated()
        ->assertJsonPath('slug', 'homologacao')
        ->assertJsonPath('name', 'Homologação');

    expect(($this->environment)('homologacao')['name'])->toBe('Homologação')
        ->and(array_column(($this->environment)('homologacao')['vars'], 'key'))->toBe(['URL']);
});

it('seeds the first environment with what the project already had in the env file', function () {
    File::put($this->dir.'/.env', "URL=https://loja.test\nUSER=qa@loja.test\nPASSWORD=segredo\n");

    getJson('/api/v1/projects/minha-loja/environments')->assertOk();

    expect(($this->environment)('ambiente')['vars'])->toBe([
        ['key' => 'URL', 'value' => 'https://loja.test', 'secret' => false],
        ['key' => 'USER', 'value' => 'qa@loja.test', 'secret' => false],
        ['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true],
    ]);
});

it('seeds the values only into the first environment', function () {
    File::put($this->dir.'/.env', "URL=https://loja.test\n");

    getJson('/api/v1/projects/minha-loja/environments')->assertOk();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Produção'])->assertCreated();

    expect(($this->environment)('producao')['vars'])
        ->toBe([['key' => 'URL', 'value' => '', 'secret' => false]]);
});

it('activates the first environment created', function () {
    getJson('/api/v1/projects/minha-loja/environments')->assertOk();

    getJson('/api/v1/projects/minha-loja/environments')->assertOk()->assertJsonPath('active', 'ambiente');
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
            ['key' => 'URL', 'value' => 'https://homolog.loja.test'],
            ['key' => 'USER', 'value' => 'qa@loja.test'],
        ],
    ])->assertOk()->assertJsonPath('vars.0.value', 'https://homolog.loja.test');

    expect(($this->environment)('homolog')['vars'])->toBe([
        ['key' => 'URL', 'value' => 'https://homolog.loja.test', 'secret' => false],
        ['key' => 'USER', 'value' => 'qa@loja.test', 'secret' => false],
    ]);
});

it('keeps a secret in the environment file, which never goes to git', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true]],
    ])->assertOk()->assertJsonPath('vars.0.value', 'segredo');

    expect(($this->environment)('homolog')['vars'])
        ->toContain(['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true])
        ->and(File::get($this->dir.'/.gitignore'))->toContain('environments');
});

it('gives each environment its own value for the same key', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'PASSWORD', 'value' => 'senha-de-homolog', 'secret' => true]],
    ])->assertOk();

    putJson('/api/v1/projects/minha-loja/environments/producao', [
        'name' => 'Producao',
        'vars' => [['key' => 'PASSWORD', 'value' => 'senha-de-producao', 'secret' => true]],
    ])->assertOk();

    expect(($this->environment)('homolog')['vars'][0]['value'])->toBe('senha-de-homolog')
        ->and(($this->environment)('producao')['vars'][0]['value'])->toBe('senha-de-producao');
});

it('adds a new key to every other environment, with the value in branco', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'CUPOM_VALIDO', 'value' => 'ABC']],
    ])->assertOk();

    expect(($this->environment)('producao')['vars'])
        ->toContain(['key' => 'CUPOM_VALIDO', 'value' => '', 'secret' => false]);
});

it('removes a key from every other environment', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [
            ['key' => 'URL', 'value' => 'https://homolog.test'],
            ['key' => 'CUPOM_VALIDO', 'value' => 'ABC'],
        ],
    ])->assertOk();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'URL', 'value' => 'https://homolog.test']],
    ])->assertOk();

    expect(array_column(($this->environment)('producao')['vars'], 'key'))->toBe(['URL']);
});

it('keeps the value each environment already had while syncing the keys', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();

    putJson('/api/v1/projects/minha-loja/environments/producao', [
        'name' => 'Producao',
        'vars' => [['key' => 'URL', 'value' => 'https://loja.test']],
    ])->assertOk();

    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [
            ['key' => 'URL', 'value' => 'https://homolog.test'],
            ['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true],
        ],
    ])->assertOk();

    expect(($this->environment)('producao')['vars'])->toBe([
        ['key' => 'URL', 'value' => 'https://loja.test', 'secret' => false],
        ['key' => 'PASSWORD', 'value' => '', 'secret' => true],
    ]);
});

it('is born with the keys the other environments already declare', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [
            ['key' => 'URL', 'value' => 'https://homolog.test'],
            ['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true],
        ],
    ])->assertOk();

    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();

    expect(($this->environment)('producao')['vars'])->toBe([
        ['key' => 'URL', 'value' => '', 'secret' => false],
        ['key' => 'PASSWORD', 'value' => '', 'secret' => true],
    ]);
});

it('marks a variable as pending while it has no value', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'PASSWORD', 'value' => null, 'secret' => true]],
    ])->assertOk();

    getJson('/api/v1/projects/minha-loja/environments')
        ->assertOk()
        ->assertJsonPath('environments.0.vars.0.pending', true);
});

it('offers the known keys for autocomplete', function () {
    File::put($this->dir.'/.env.example', "URL=\nCPF_TESTE=\n");
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'CUPOM_VALIDO', 'value' => 'ABC']],
    ])->assertOk();

    expect(getJson('/api/v1/projects/minha-loja/environments')->assertOk()->json('known_keys'))
        ->toContain('URL', 'CPF_TESTE', 'CUPOM_VALIDO');
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
            ['key' => 'URL', 'value' => 'https://a.test'],
            ['key' => 'URL', 'value' => 'https://b.test'],
        ],
    ])->assertStatus(422)->assertJsonValidationErrors(['vars.1.key']);
});

it('activates another environment', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();

    postJson('/api/v1/projects/minha-loja/environments/producao/activate')
        ->assertOk()
        ->assertJsonPath('slug', 'producao');

    expect(($this->dotenv)())->toContain('ENVIRONMENT=producao');
});

it('falls back to the first environment when the active one no longer exists', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();
    File::put($this->dir.'/.env', "ENVIRONMENT=apagado\n");

    getJson('/api/v1/projects/minha-loja/environments')->assertOk()->assertJsonPath('active', 'ambiente');
});

it('deletes an environment and forgets it was the active one', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Producao'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments/producao/activate')->assertOk();

    deleteJson('/api/v1/projects/minha-loja/environments/producao')->assertNoContent();

    expect(File::exists($this->dir.'/environments/producao.json'))->toBeFalse()
        ->and(($this->dotenv)())->not->toContain('ENVIRONMENT=producao');

    getJson('/api/v1/projects/minha-loja/environments')->assertOk()->assertJsonPath('active', 'ambiente');
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
    postJson('/api/v1/projects/minha-loja/environments/homolog/activate')->assertOk();

    putJson('/api/v1/projects/minha-loja/settings', ['baseUrl' => 'https://homolog.loja.test'])->assertOk();

    expect(($this->environment)('homolog')['vars'])
        ->toContain(['key' => 'URL', 'value' => 'https://homolog.loja.test', 'secret' => false]);

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

it('saves the credentials into the active environment, with the password as a secret', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments/homolog/activate')->assertOk();

    postJson('/api/v1/projects/minha-loja/auth/credentials', [
        'username' => 'qa@loja.test',
        'password' => 'segredo',
    ])->assertNoContent();

    expect(($this->environment)('homolog')['vars'])->toContain(
        ['key' => 'USER', 'value' => 'qa@loja.test', 'secret' => false],
        ['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true],
    );
});

it('falls back to the default only when the key is not in the env file', function () {
    File::put($this->dir.'/.env', "URL=https://loja.test\n");

    $env = Project::make('minha-loja')->env();

    expect($env->get(EnvKey::USER))->toBeNull()
        ->and($env->get(EnvKey::USER, 'ninguem'))->toBe('ninguem')
        ->and($env->get(EnvKey::URL, 'https://padrao.test'))->toBe('https://loja.test');
});

it('falls back to the default when the active environment leaves the key empty', function () {
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [['key' => 'URL', 'value' => null]],
    ])->assertOk();

    $environments = Project::make('minha-loja')->environments();

    expect($environments->value(EnvKey::URL))->toBeNull()
        ->and($environments->value(EnvKey::URL, 'https://padrao.test'))->toBe('https://padrao.test');
});

it('runs against the active environment', function () {
    Http::fake(['*/runner/project' => Http::response(['passed' => true, 'output' => 'ok'])]);

    File::put($this->dir.'/.env', "CUPOM_VALIDO=ABC\n");
    postJson('/api/v1/projects/minha-loja/environments', ['name' => 'Homolog'])->assertCreated();
    postJson('/api/v1/projects/minha-loja/environments/homolog/activate')->assertOk();
    putJson('/api/v1/projects/minha-loja/environments/homolog', [
        'name' => 'Homolog',
        'vars' => [
            ['key' => 'URL', 'value' => 'https://homolog.loja.test'],
            ['key' => 'PASSWORD', 'value' => 'segredo', 'secret' => true],
        ],
    ])->assertOk();

    postJson('/api/v1/projects/minha-loja/run')->assertOk();

    Http::assertSent(fn ($request) => $request['env']['URL'] === 'https://homolog.loja.test'
        && $request['env']['PASSWORD'] === 'segredo'
        && $request['env']['CUPOM_VALIDO'] === 'ABC'
        && $request['env']['STORAGE_STATE'] === 'storage-state.homolog.json');
});

it('sends no environment to the runner while the project has none', function () {
    Http::fake(['*/runner/project' => Http::response(['passed' => true, 'output' => 'ok'])]);

    postJson('/api/v1/projects/minha-loja/run')->assertOk();

    Http::assertSent(fn ($request) => $request['env'] === null);
});
