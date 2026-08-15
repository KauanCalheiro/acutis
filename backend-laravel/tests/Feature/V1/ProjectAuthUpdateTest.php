<?php

use Illuminate\Support\Facades\File;

use function Pest\Laravel\putJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    $this->dir = $this->projectsPath.'/minha-loja';
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/acutis.json', json_encode([
        'name' => 'Minha Loja',
        'slug' => 'minha-loja',
        'created_at' => '2026-01-01T00:00:00+00:00',
        'version' => 1,
    ]));
    File::put($this->dir.'/tests/auth.setup.ts', 'conteudo original');
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('overwrites the auth setup with the edited content', function () {
    putJson('/api/v1/projects/minha-loja/auth', ['authSetup' => 'conteudo editado'])
        ->assertOk()
        ->assertJsonPath('authSetup', 'conteudo editado');

    expect(File::get($this->dir.'/tests/auth.setup.ts'))->toBe('conteudo editado');
});

it('validates the auth setup is required', function () {
    putJson('/api/v1/projects/minha-loja/auth', ['authSetup' => ''])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['authSetup']);
});

it('returns 404 for an unknown project', function () {
    putJson('/api/v1/projects/nao-existe/auth', ['authSetup' => 'x'])->assertNotFound();
});
