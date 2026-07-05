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

it('deletes the project folder', function () {
    deleteJson('/api/v1/projects/minha-loja')->assertNoContent();

    expect(File::exists($this->dir))->toBeFalse();
});

it('returns 404 for an unknown project', function () {
    deleteJson('/api/v1/projects/nao-existe')->assertNotFound();
});
