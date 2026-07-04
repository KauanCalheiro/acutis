<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function bareProject(string $name = 'Portal Sistema'): string
{
    postJson('/api/v1/projects/create/template', ['name' => $name])->assertCreated();

    return Str::slug($name);
}

it('runs the whole project and returns the result', function () {
    Http::fake(['*/runner/project' => Http::response(['passed' => true, 'output' => '2 passed'])]);
    $slug = bareProject();

    postJson("/api/v1/projects/{$slug}/run")
        ->assertOk()
        ->assertJsonPath('passed', true)
        ->assertJsonPath('output', '2 passed');

    Http::assertSent(fn ($request) => str_contains($request->url(), '/runner/project')
        && str_ends_with($request['path'], "/{$slug}")
        && $request['spec'] === null
        && $request['grep'] === null);
});

it('forwards a specific spec and a tag to the runner', function () {
    Http::fake(['*/runner/project' => Http::response(['passed' => true, 'output' => 'ok'])]);
    $slug = bareProject();

    postJson("/api/v1/projects/{$slug}/run", ['spec' => 'tests/login.spec.ts', 'grep' => '@smoke'])
        ->assertOk();

    Http::assertSent(fn ($request) => $request['spec'] === 'tests/login.spec.ts' && $request['grep'] === '@smoke');
});

it('reports a failing run', function () {
    Http::fake(['*/runner/project' => Http::response(['passed' => false, 'output' => '1 failed'])]);
    $slug = bareProject();

    postJson("/api/v1/projects/{$slug}/run")
        ->assertOk()
        ->assertJsonPath('passed', false)
        ->assertJsonPath('output', '1 failed');
});

it('returns 404 for a project that does not exist', function () {
    Http::fake();

    postJson('/api/v1/projects/inexistente/run')->assertNotFound();
});
