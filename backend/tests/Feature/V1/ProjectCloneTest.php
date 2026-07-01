<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    // repo git local que serve de "remote" para o clone (sem rede)
    $this->sourceRepo = sys_get_temp_dir().'/acutis-source-'.uniqid();
    File::ensureDirectoryExists($this->sourceRepo);
    (new Process(['git', 'init', '-q'], $this->sourceRepo))->mustRun();
    File::put($this->sourceRepo.'/README.md', "# fonte\n");
    (new Process([
        'git', '-c', 'user.email=t@t.dev', '-c', 'user.name=Test',
        'commit', '--allow-empty', '-qm', 'init',
    ], $this->sourceRepo))->mustRun();
    (new Process(['git', 'add', '-A'], $this->sourceRepo))->mustRun();
    (new Process([
        'git', '-c', 'user.email=t@t.dev', '-c', 'user.name=Test',
        'commit', '-qm', 'readme',
    ], $this->sourceRepo))->mustRun();
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
    File::deleteDirectory($this->sourceRepo);
});

it('clones a public repository', function () {
    postJson('/api/v1/projects/create/clone', [
        'url' => $this->sourceRepo,
        'name' => 'Cloned App',
    ])
        ->assertCreated()
        ->assertJsonPath('name', 'Cloned App')
        ->assertJsonPath('slug', 'cloned-app')
        ->assertJsonPath('path', $this->projectsPath.'/cloned-app')
        ->assertJsonPath('repository', $this->sourceRepo)
        ->assertJsonPath('provider', null)
        ->assertJsonStructure(['created_at']);

    $dir = $this->projectsPath.'/cloned-app';

    expect(File::isDirectory($dir.'/.git'))->toBeTrue()
        ->and(File::exists($dir.'/README.md'))->toBeTrue()
        ->and(File::exists($dir.'/acutis.json'))->toBeTrue();

    $manifest = json_decode(File::get($dir.'/acutis.json'), true);
    expect($manifest['name'])->toBe('Cloned App')
        ->and($manifest['slug'])->toBe('cloned-app')
        ->and($manifest)->toHaveKeys(['created_at', 'version']);
});

it('derives the name from the repo url when omitted', function () {
    $expected = Str::slug(basename($this->sourceRepo));

    postJson('/api/v1/projects/create/clone', ['url' => $this->sourceRepo])
        ->assertCreated()
        ->assertJsonPath('slug', $expected);
});

it('requires a url', function () {
    postJson('/api/v1/projects/create/clone', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('url');
});

it('requires a token when auth is token', function () {
    postJson('/api/v1/projects/create/clone', [
        'url' => 'https://github.com/acme/app.git',
        'auth' => 'token',
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('token');
});

it('requires an ssh key when auth is ssh_key', function () {
    postJson('/api/v1/projects/create/clone', [
        'url' => 'git@github.com:acme/app.git',
        'auth' => 'ssh_key',
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('ssh_key');
});

it('rejects an invalid auth method', function () {
    postJson('/api/v1/projects/create/clone', [
        'url' => 'https://github.com/acme/app.git',
        'auth' => 'nope',
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('auth');
});

it('rejects cloning into an existing project', function () {
    File::ensureDirectoryExists($this->projectsPath.'/cloned-app');

    postJson('/api/v1/projects/create/clone', [
        'url' => $this->sourceRepo,
        'name' => 'Cloned App',
    ])
        ->assertStatus(422)
        ->assertJsonValidationErrors('url');
});
