<?php

use Illuminate\Support\Facades\File;

use function Pest\Laravel\deleteJson;

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

it('deletes the scenario files', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::ensureDirectoryExists($this->dir.'/features');
    File::put($this->dir.'/tests/login.spec.ts', "test.describe('Login', () => {})");
    File::put($this->dir.'/features/login.feature', 'Funcionalidade: Login');
    File::put($this->dir.'/tests/login.events.json', '[]');

    deleteJson('/api/v1/projects/minha-loja/scenarios/login')->assertNoContent();

    expect(File::exists($this->dir.'/tests/login.spec.ts'))->toBeFalse();
    expect(File::exists($this->dir.'/features/login.feature'))->toBeFalse();
    expect(File::exists($this->dir.'/tests/login.events.json'))->toBeFalse();
});

it('deletes a scenario nested in a domain', function () {
    File::ensureDirectoryExists($this->dir.'/tests/checkout');
    File::put($this->dir.'/tests/checkout/pagamento.spec.ts', "test.describe('Pagamento', () => {})");

    deleteJson('/api/v1/projects/minha-loja/scenarios/checkout/pagamento')->assertNoContent();

    expect(File::exists($this->dir.'/tests/checkout/pagamento.spec.ts'))->toBeFalse();
});

it('returns 404 for an unknown scenario', function () {
    File::ensureDirectoryExists($this->dir.'/tests');

    deleteJson('/api/v1/projects/minha-loja/scenarios/nao-existe')->assertNotFound();
});

it('returns 404 for an unknown project', function () {
    deleteJson('/api/v1/projects/nao-existe/scenarios/login')->assertNotFound();
});
