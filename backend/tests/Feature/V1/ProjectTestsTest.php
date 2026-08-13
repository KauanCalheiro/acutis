<?php

use App\Enums\EnvKey;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
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

it('writes the recorded events alongside the generated artifacts', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload([
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => null, 'label' => null, 'value' => null, 'sensitive' => false],
            ['type' => 'fill', 'timestamp' => 2, 'url' => 'https://sistema.test/login', 'selectors' => ['id' => 'senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true],
        ],
    ]))->assertOk();

    $events = File::get($this->projectsPath."/{$slug}/tests/login/login-do-cliente.events.json");

    expect($events)->toContain('"type":"navigate"')
        ->toContain('"type":"fill"')
        ->not->toContain('topsecret123')
        ->and(json_decode($events, true)[1]['value'])->toBe('{{SENSIVEL_1}}');
});

it('writes the captured html to its own file, keeping the events readable', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload([
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sistema.test/', 'selectors' => null, 'label' => null, 'value' => null, 'html' => null],
            ['type' => 'click', 'timestamp' => 2, 'url' => 'https://sistema.test/', 'selectors' => ['cssStable' => '.btn'], 'label' => 'Salvar', 'value' => null, 'html' => '<div><button class="btn">Salvar</button></div>'],
        ],
    ]))->assertOk();

    $dir = $this->projectsPath."/{$slug}/tests/login";

    expect(File::get($dir.'/login-do-cliente.events.json'))->not->toContain('<button')
        ->and(json_decode(File::get($dir.'/login-do-cliente.dom.json'), true))
        ->toBe(['1' => '<div><button class="btn">Salvar</button></div>']);
});

it('keeps the captured html out of git, since only the machine that recorded it needs it', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload())->assertOk();

    expect(File::get($this->projectsPath."/{$slug}/.gitignore"))->toContain('*.dom.json');
});

it('writes the env var the ai declared for a masked value into the environment', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload([
        'playwright' => "import { test } from '@playwright/test'\n// process.env.SENHA_UNIVATES",
        'envVars' => ['SENHA_UNIVATES'],
        'events' => [
            ['type' => 'navigate', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => null, 'label' => null, 'value' => null, 'sensitive' => false],
            ['type' => 'fill', 'timestamp' => 2, 'url' => 'https://sistema.test/login', 'selectors' => ['id' => 'senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true],
        ],
    ]))->assertOk();

    $dir = $this->projectsPath."/{$slug}";

    $environment = json_decode(File::get($dir.'/environments/ambiente.json'), true);

    expect($environment['vars'])->toContain(['key' => 'SENHA_UNIVATES', 'value' => 'topsecret123', 'secret' => false])
        ->and(File::get($dir.'/.gitignore'))->toContain('environments');
});

it('merges into the environment without clobbering the variables already there', function () {
    $slug = project();
    $dir = $this->projectsPath."/{$slug}";

    postJson("/api/v1/projects/{$slug}/auth/credentials", ['username' => 'someone', 'password' => 'oldpass'])
        ->assertNoContent();

    postJson("/api/v1/projects/{$slug}/tests", writePayload([
        'envVars' => ['SENHA_UNIVATES'],
        'events' => [
            ['type' => 'fill', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => ['id' => 'senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true],
        ],
    ]))->assertOk();

    $environment = json_decode(File::get($dir.'/environments/ambiente.json'), true);

    expect($environment['vars'])->toContain(
        ['key' => EnvKey::USER->value, 'value' => 'someone', 'secret' => false],
        ['key' => EnvKey::PASSWORD->value, 'value' => 'oldpass', 'secret' => true],
        ['key' => 'SENHA_UNIVATES', 'value' => 'topsecret123', 'secret' => false],
    );
});

it('logs a warning when there is a sensitive value but the ai declared no env var for it', function () {
    Log::spy();
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload([
        'envVars' => [],
        'events' => [
            ['type' => 'fill', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => ['id' => 'senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true],
        ],
    ]))->assertOk();

    Log::shouldHaveReceived('warning')->once();
});

it('logs a warning when the ai declares more env vars than there are sensitive values', function () {
    Log::spy();
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload([
        'envVars' => ['SENHA_UNIVATES', 'SEGUNDA_SENHA'],
        'events' => [
            ['type' => 'fill', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => ['id' => 'senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true],
        ],
    ]))->assertOk();

    Log::shouldHaveReceived('warning')->once();
});

it('does not log a warning when every declared env var matches a sensitive value', function () {
    Log::spy();
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload([
        'envVars' => ['SENHA_UNIVATES'],
        'events' => [
            ['type' => 'fill', 'timestamp' => 1, 'url' => 'https://sistema.test/login', 'selectors' => ['id' => 'senha'], 'label' => 'Senha', 'value' => 'topsecret123', 'sensitive' => true],
        ],
    ]))->assertOk();

    Log::shouldNotHaveReceived('warning');
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

/** Título que vira nome de arquivo: sem teto, o modelo devolve a feature inteira e o sistema de arquivos recusa. */
it('refuses a title longer than a file name can hold', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload(['title' => str_repeat('cenário ', 40)]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('title');
});

it('refuses a path longer than a file name can hold', function () {
    $slug = project();

    postJson("/api/v1/projects/{$slug}/tests", writePayload(['path' => str_repeat('caminho-', 20)]))
        ->assertStatus(422)
        ->assertJsonValidationErrors('path');
});
