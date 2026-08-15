<?php

use Illuminate\Support\Facades\File;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

it('creates a project from the template', function () {
    postJson('/api/v1/projects/create/template', ['name' => 'My New Project'])
        ->assertCreated()
        ->assertJsonPath('name', 'My New Project')
        ->assertJsonPath('slug', 'my-new-project')
        ->assertJsonPath('path', $this->projectsPath.'/my-new-project')
        ->assertJsonPath('repository', null)
        ->assertJsonPath('provider', null)
        ->assertJsonStructure(['created_at']);

    $dir = $this->projectsPath.'/my-new-project';

    expect(File::isDirectory($dir))->toBeTrue()
        ->and(File::exists($dir.'/playwright.config.ts'))->toBeTrue()
        ->and(File::exists($dir.'/tests/example.spec.ts'))->toBeFalse();

    expect(File::get($dir.'/package.json'))
        ->toContain('"name": "my-new-project"')
        ->not->toContain('{{name}}');

    expect(File::exists($dir.'/acutis.json'))->toBeTrue();
    $manifest = json_decode(File::get($dir.'/acutis.json'), true);
    expect($manifest['name'])->toBe('My New Project')
        ->and($manifest['slug'])->toBe('my-new-project')
        ->and($manifest)->toHaveKeys(['created_at', 'version']);
});

it('requires a name', function () {
    postJson('/api/v1/projects/create/template', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('name');
});

it('rejects a duplicate project', function () {
    File::ensureDirectoryExists($this->projectsPath.'/my-app');

    postJson('/api/v1/projects/create/template', ['name' => 'My App'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('name');
});

it('rejects a name that sanitizes to empty', function () {
    postJson('/api/v1/projects/create/template', ['name' => '!!!'])
        ->assertStatus(422)
        ->assertJsonValidationErrors('name');
});
