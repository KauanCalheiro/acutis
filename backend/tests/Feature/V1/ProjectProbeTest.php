<?php

use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

use function Pest\Laravel\postJson;

beforeEach(function () {
    // repo git local acessível sem credencial = comporta-se como público
    $this->sourceRepo = sys_get_temp_dir().'/acutis-probe-'.uniqid();
    File::ensureDirectoryExists($this->sourceRepo);
    (new Process(['git', 'init', '-q'], $this->sourceRepo))->mustRun();
    (new Process([
        'git', '-c', 'user.email=t@t.dev', '-c', 'user.name=Test',
        'commit', '--allow-empty', '-qm', 'init',
    ], $this->sourceRepo))->mustRun();
});

afterEach(function () {
    File::deleteDirectory($this->sourceRepo);
});

it('reports an accessible repository as public', function () {
    postJson('/api/v1/projects/probe', ['url' => $this->sourceRepo])
        ->assertOk()
        ->assertJsonPath('public', true);
});

it('reports an unreachable repository as not public', function () {
    postJson('/api/v1/projects/probe', ['url' => sys_get_temp_dir().'/acutis-nao-existe-'.uniqid()])
        ->assertOk()
        ->assertJsonPath('public', false);
});

it('requires a url', function () {
    postJson('/api/v1/projects/probe', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors('url');
});
