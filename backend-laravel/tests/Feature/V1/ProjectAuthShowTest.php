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

it('shows the existing auth setup content', function () {
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/tests/auth.setup.ts', "import { test as setup } from '@playwright/test'\n// login gravado");

    getJson('/api/v1/projects/minha-loja/auth')
        ->assertOk()
        ->assertJsonPath('authSetup', "import { test as setup } from '@playwright/test'\n// login gravado");
});

it('returns 404 when the project has no auth setup yet', function () {
    getJson('/api/v1/projects/minha-loja/auth')->assertNotFound();
});

it('returns 404 for an unknown project', function () {
    getJson('/api/v1/projects/nao-existe/auth')->assertNotFound();
});
