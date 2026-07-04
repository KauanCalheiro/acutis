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

it('proxies the run stream as server-sent events', function () {
    Http::fake([
        '*/runner/project/stream' => Http::response(
            "{\"event\":\"run:started\",\"total\":1}\n{\"event\":\"test:passed\",\"title\":\"ok\"}\n{\"event\":\"run:finished\",\"passed\":true}\n"
        ),
    ]);
    $slug = bareProject();

    $response = $this->get("/api/v1/projects/{$slug}/run/stream");
    $response->assertOk();
    $response->assertHeader('Content-Type', 'text/event-stream; charset=UTF-8');

    $content = $response->streamedContent();
    expect($content)->toContain('data: {"event":"run:started","total":1}')
        ->toContain('data: {"event":"run:finished","passed":true}');

    Http::assertSent(fn ($request) => str_contains($request->url(), '/runner/project/stream')
        && str_ends_with($request['path'], "/{$slug}"));
});

it('forwards spec and grep to the stream and hides the container path', function () {
    Http::fake(['*/runner/project/stream' => Http::response("{\"event\":\"run:finished\",\"passed\":true}\n")]);
    $slug = bareProject();

    $this->get("/api/v1/projects/{$slug}/run/stream?spec=tests/x.spec.ts&grep=@smoke")->assertOk()->streamedContent();

    Http::assertSent(fn ($request) => $request['spec'] === 'tests/x.spec.ts' && $request['grep'] === '@smoke');
});

it('returns 404 when streaming a project that does not exist', function () {
    Http::fake();

    $this->get('/api/v1/projects/inexistente/run/stream')->assertNotFound();
});
