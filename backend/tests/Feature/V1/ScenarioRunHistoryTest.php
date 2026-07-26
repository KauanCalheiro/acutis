<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

use function Pest\Laravel\getJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    $this->dir = $this->projectsPath.'/minha-loja';
    File::ensureDirectoryExists($this->dir.'/tests/login');
    File::put($this->dir.'/acutis.json', json_encode([
        'name' => 'Minha Loja',
        'slug' => 'minha-loja',
        'created_at' => '2026-01-01T00:00:00+00:00',
        'version' => 1,
    ]));
    File::put($this->dir.'/tests/login/entrar.spec.ts', "test.describe('Entrar', () => {})");

    $this->history = $this->dir.'/runs/login/entrar';
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function runEvents(array $events): string
{
    return collect($events)->map(fn (array $event): string => json_encode($event))->implode("\n")."\n";
}

function passingRun(?string $videoPath = null): string
{
    return runEvents([
        ['event' => 'run:started', 'total' => 1, 'steps' => ['Acessar a home']],
        ['event' => 'step', 'testId' => 'a1', 'title' => 'Acessar a home', 'status' => 'pending'],
        ['event' => 'step', 'testId' => 'a1', 'title' => 'Acessar a home', 'status' => 'success', 'durationMs' => 120, 'error' => null],
        ['event' => 'test', 'id' => 'a1', 'title' => 'Entrar', 'status' => 'success', 'durationMs' => 900, 'error' => null, 'videoPath' => $videoPath],
        ['event' => 'run:finished', 'status' => 'passed', 'passed' => true],
    ]);
}

function failingRun(): string
{
    return runEvents([
        ['event' => 'run:started', 'total' => 1, 'steps' => ['Acessar a home']],
        ['event' => 'step', 'testId' => 'a1', 'title' => 'Acessar a home', 'status' => 'pending'],
        ['event' => 'step', 'testId' => 'a1', 'title' => 'Acessar a home', 'status' => 'failed', 'durationMs' => 30000, 'error' => 'locator resolveu como hidden'],
        ['event' => 'test', 'id' => 'a1', 'title' => 'Entrar', 'status' => 'failed', 'durationMs' => 30100, 'error' => 'timeout', 'videoPath' => null],
        ['event' => 'run:finished', 'status' => 'failed', 'passed' => false],
    ]);
}

function abortedRun(): string
{
    return runEvents([
        ['event' => 'run:started', 'total' => 1, 'steps' => ['Acessar a home', 'Clicar em Entrar', 'Ver o painel']],
        ['event' => 'step', 'testId' => 'a1', 'title' => 'Acessar a home', 'status' => 'pending'],
        ['event' => 'step', 'testId' => 'a1', 'title' => 'Acessar a home', 'status' => 'success', 'durationMs' => 120, 'error' => null],
        ['event' => 'step', 'testId' => 'a1', 'title' => 'Clicar em Entrar', 'status' => 'pending'],
        ['event' => 'step', 'testId' => 'a1', 'title' => 'Clicar em Entrar', 'status' => 'failed', 'durationMs' => 0, 'error' => 'Test timeout of 30000ms exceeded.'],
        ['event' => 'test', 'id' => 'a1', 'title' => 'Entrar', 'status' => 'failed', 'durationMs' => 31982, 'error' => 'Test timeout of 30000ms exceeded.', 'videoPath' => null],
        ['event' => 'run:finished', 'status' => 'failed', 'passed' => false],
    ]);
}

function streamScenario(string ...$bodies): void
{
    $sequence = Http::sequence();

    foreach ($bodies as $body) {
        $sequence->push($body);
    }

    Http::fake(['*/runner/project/stream' => $sequence]);

    foreach ($bodies as $body) {
        test()->get('/api/v1/projects/minha-loja/run/stream?spec=tests/login/entrar.spec.ts')
            ->assertOk()
            ->streamedContent();
    }
}

function savedRuns(string $history): array
{
    return collect(File::glob($history.'/*.json'))
        ->map(fn (string $file): array => json_decode(File::get($file), true))
        ->all();
}

it('saves the run to the scenario history', function () {
    streamScenario(failingRun());

    $runs = savedRuns($this->history);

    expect($runs)->toHaveCount(1);
    expect($runs[0]['passed'])->toBeFalse();
    expect($runs[0]['duration_ms'])->toBe(30100);
    expect($runs[0]['steps'])->toBe([[
        'title' => 'Acessar a home',
        'status' => 'failed',
        'duration_ms' => 30000,
        'error' => 'locator resolveu como hidden',
    ]]);
    expect($runs[0]['started_at'])->not->toBeEmpty();
});

it('keeps the steps that never ran after the failure', function () {
    streamScenario(abortedRun());

    expect(savedRuns($this->history)[0]['steps'])->toBe([
        [
            'title' => 'Acessar a home',
            'status' => 'success',
            'duration_ms' => 120,
            'error' => null,
        ],
        [
            'title' => 'Clicar em Entrar',
            'status' => 'failed',
            'duration_ms' => 0,
            'error' => 'Test timeout of 30000ms exceeded.',
        ],
        [
            'title' => 'Ver o painel',
            'status' => 'waiting',
            'duration_ms' => 0,
            'error' => null,
        ],
    ]);
});

it('saves the playwright code that ran without the runner wrapper', function () {
    File::put($this->dir.'/tests/login/entrar.spec.ts', "import { test } from '../../acutis-run'\ntest.describe('Entrar', () => {})");

    streamScenario(passingRun());

    expect(savedRuns($this->history)[0]['playwright'])
        ->toBe("import { test } from '@playwright/test'\ntest.describe('Entrar', () => {})");
});

it('copies the video of the run into the history', function () {
    File::ensureDirectoryExists($this->dir.'/test-results/entrar');
    File::put($this->dir.'/test-results/entrar/video.webm', 'webm-bytes');

    streamScenario(passingRun($this->dir.'/test-results/entrar/video.webm'));

    expect(File::get($this->history.'/last.webm'))->toBe('webm-bytes');
    expect(savedRuns($this->history)[0]['video'])->toBeTrue();
});

it('lists the runs in the scenario, newest first', function () {
    streamScenario(failingRun(), passingRun());

    getJson('/api/v1/projects/minha-loja/scenarios/login/entrar')
        ->assertOk()
        ->assertJsonCount(2, 'runs')
        ->assertJsonPath('runs.0.passed', true)
        ->assertJsonPath('runs.1.passed', false)
        ->assertJsonPath('runs.1.steps.0.error', 'locator resolveu como hidden');
});

it('points the video at the newest run that recorded one', function () {
    File::ensureDirectoryExists($this->dir.'/test-results/entrar');
    File::put($this->dir.'/test-results/entrar/video.webm', 'webm-bytes');

    streamScenario(passingRun($this->dir.'/test-results/entrar/video.webm'), failingRun());

    getJson('/api/v1/projects/minha-loja/scenarios/login/entrar')
        ->assertOk()
        ->assertJsonPath('runs.0.video_path', null)
        ->assertJsonPath('runs.1.video_path', $this->history.'/last.webm');
});

it('commits the run when the project is a git repository', function () {
    initRepository($this->dir);

    streamScenario(passingRun());

    expect(gitOutput($this->dir, ['log', '--name-only', '--pretty=format:%s']))
        ->toContain('runs/login/entrar/')
        ->toContain('chore: registrar execução de login/entrar');

    $run = savedRuns($this->history)[0];
    expect($run['branch'])->toBe('trunk');
    expect($run['author'])->toBe('Testadora');
});

it('pushes the run when the project has a remote', function () {
    $origin = $this->projectsPath.'/origin.git';
    (new Process(['git', 'init', '-q', '--bare', $origin]))->mustRun();
    initRepository($this->dir);
    (new Process(['git', '-C', $this->dir, 'remote', 'add', 'origin', $origin]))->mustRun();

    streamScenario(passingRun());

    expect(gitOutput($origin, ['log', 'trunk', '--name-only', '--pretty=format:%s']))->toContain('runs/login/entrar/');
});

it('still saves the run when the project is not a git repository', function () {
    streamScenario(passingRun());

    expect(savedRuns($this->history))->toHaveCount(1);
});

it('does not save history when the whole project runs', function () {
    Http::fake(['*/runner/project/stream' => Http::response(passingRun())]);

    $this->get('/api/v1/projects/minha-loja/run/stream')->assertOk()->streamedContent();

    expect(File::isDirectory($this->dir.'/runs'))->toBeFalse();
});

function initRepository(string $dir): void
{
    (new Process(['git', 'init', '-q', '-b', 'trunk', $dir]))->mustRun();
    (new Process(['git', '-C', $dir, 'config', 'user.email', 'testadora@acutis.dev']))->mustRun();
    (new Process(['git', '-C', $dir, 'config', 'user.name', 'Testadora']))->mustRun();
    (new Process(['git', '-C', $dir, 'commit', '--allow-empty', '-qm', 'init']))->mustRun();
}

function gitOutput(string $dir, array $args): string
{
    $process = new Process(['git', '-C', $dir, ...$args]);
    $process->mustRun();

    return $process->getOutput();
}
