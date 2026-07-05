<?php

use Illuminate\Support\Facades\File;

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
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('renames the project and moves the folder', function () {
    putJson('/api/v1/projects/minha-loja', ['name' => 'Loja Nova'])
        ->assertOk()
        ->assertJsonPath('name', 'Loja Nova')
        ->assertJsonPath('slug', 'loja-nova')
        ->assertJsonPath('created_at', '2026-01-01T00:00:00+00:00');

    expect(File::exists($this->dir))->toBeFalse()
        ->and(File::exists($this->projectsPath.'/loja-nova'))->toBeTrue();

    $manifest = json_decode(File::get($this->projectsPath.'/loja-nova/acutis.json'), true);
    expect($manifest['name'])->toBe('Loja Nova')
        ->and($manifest['slug'])->toBe('loja-nova')
        ->and($manifest['created_at'])->toBe('2026-01-01T00:00:00+00:00');
});

it('keeps the same folder when only the display name changes', function () {
    putJson('/api/v1/projects/minha-loja', ['name' => 'MINHA loja'])
        ->assertOk()
        ->assertJsonPath('slug', 'minha-loja');

    expect(File::exists($this->dir))->toBeTrue();
});

it('requires a name', function () {
    putJson('/api/v1/projects/minha-loja', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('name');
});

it('rejects a name that collides with another project', function () {
    File::ensureDirectoryExists($this->projectsPath.'/outra-loja');
    File::put($this->projectsPath.'/outra-loja/acutis.json', json_encode([
        'name' => 'Outra Loja',
        'slug' => 'outra-loja',
    ]));

    putJson('/api/v1/projects/minha-loja', ['name' => 'Outra Loja'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('name');
});

it('returns 404 for an unknown project', function () {
    putJson('/api/v1/projects/nao-existe', ['name' => 'Novo'])->assertNotFound();
});
