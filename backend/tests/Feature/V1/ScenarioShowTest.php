<?php

use Illuminate\Support\Facades\File;

use function Pest\Laravel\getJson;

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

it('shows the scenario content', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::ensureDirectoryExists($this->dir.'/features');
    File::put($this->dir.'/tests/login.spec.ts', "test.describe('Login', { tag: ['@read'] }, () => {})");
    File::put($this->dir.'/features/login.feature', 'Funcionalidade: Login');

    getJson('/api/v1/projects/minha-loja/scenarios/login')
        ->assertOk()
        ->assertJsonPath('title', 'Login')
        ->assertJsonPath('spec', 'tests/login.spec.ts')
        ->assertJsonPath('feature', 'features/login.feature')
        ->assertJsonPath('domain', null)
        ->assertJsonPath('tags', ['@read'])
        ->assertJsonPath('gherkin', 'Funcionalidade: Login')
        ->assertJsonPath('playwright', "test.describe('Login', { tag: ['@read'] }, () => {})")
        ->assertJsonPath('events', []);
});

it('shows the persisted recording events', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/login.spec.ts', "test.describe('Login', () => {})");
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'click', 'label' => 'Entrar'],
    ]));

    getJson('/api/v1/projects/minha-loja/scenarios/login')
        ->assertOk()
        ->assertJsonPath('events.0.type', 'click')
        ->assertJsonPath('events.0.label', 'Entrar');
});

it('shows a scenario nested in a domain', function () {
    File::ensureDirectoryExists($this->dir.'/tests/checkout');
    File::put($this->dir.'/tests/checkout/pagamento.spec.ts', "test.describe('Pagamento', () => {})");

    getJson('/api/v1/projects/minha-loja/scenarios/checkout/pagamento')
        ->assertOk()
        ->assertJsonPath('domain', 'checkout')
        ->assertJsonPath('spec', 'tests/checkout/pagamento.spec.ts');
});

it('returns 404 for an unknown scenario', function () {
    File::ensureDirectoryExists($this->dir.'/tests');

    getJson('/api/v1/projects/minha-loja/scenarios/nao-existe')->assertNotFound();
});

it('returns 404 for an unknown project', function () {
    getJson('/api/v1/projects/nao-existe/scenarios/login')->assertNotFound();
});
