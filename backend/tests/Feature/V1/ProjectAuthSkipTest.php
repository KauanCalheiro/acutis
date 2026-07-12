<?php

use Illuminate\Support\Facades\File;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

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

it('marks the project as skipped', function () {
    postJson('/api/v1/projects/minha-loja/auth/skip')->assertNoContent();

    getJson('/api/v1/projects/minha-loja')
        ->assertOk()
        ->assertJsonPath('auth_status', 'skipped');
});

it('preserves the rest of the manifest', function () {
    postJson('/api/v1/projects/minha-loja/auth/skip')->assertNoContent();

    $manifest = json_decode(File::get($this->dir.'/acutis.json'), true);

    expect($manifest['name'])->toBe('Minha Loja')
        ->and($manifest['slug'])->toBe('minha-loja')
        ->and($manifest['auth_skipped'])->toBeTrue();
});

it('returns 404 for an unknown project', function () {
    postJson('/api/v1/projects/nao-existe/auth/skip')->assertNotFound();
});
