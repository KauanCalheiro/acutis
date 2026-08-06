<?php

use App\Ai\Tools\RunSpec;
use App\Enums\EnvKey;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Tools\Request;

const SPEC_SOURCE = "import { test } from '@playwright/test'";

function fakeRun(array ...$responses): void
{
    $sequence = Http::sequence();

    foreach ($responses as $body) {
        $sequence->push($body);
    }

    Http::fake(['*/runner/spec' => $sequence]);
}

function runSpec(RunSpec $tool, string $spec = SPEC_SOURCE): string
{
    return $tool->handle(new Request(['spec' => $spec]));
}

it('tells the agent the spec passed', function () {
    fakeRun(['passed' => true, 'output' => '1 passed']);

    expect(runSpec(new RunSpec))->toContain('passou');
});

it('hands the agent the failure output, which is what it needs to fix the spec', function () {
    fakeRun(['passed' => false, 'output' => 'locator.click: Timeout 30000ms exceeded']);

    expect(runSpec(new RunSpec))->toContain('Timeout 30000ms exceeded');
});

it('sends the spec, the execution url and the environment to the webdriver', function () {
    fakeRun(['passed' => true, 'output' => '']);

    runSpec(new RunSpec('https://execucao.test', [EnvKey::URL->value => 'https://execucao.test']));

    Http::assertSent(fn ($request) => $request['spec'] === SPEC_SOURCE
        && $request['baseUrl'] === 'https://execucao.test'
        && $request['env'] === ['URL' => 'https://execucao.test']);
});

it('counts how many times the agent ran the spec, so the action can report the attempts', function () {
    fakeRun(['passed' => false, 'output' => 'erro'], ['passed' => true, 'output' => 'ok']);

    $tool = new RunSpec;
    runSpec($tool);
    runSpec($tool);

    expect($tool->attempts())->toBe(2);
});

it('has no attempts before the agent runs anything', function () {
    expect((new RunSpec)->attempts())->toBe(0);
});

it('keeps the last result for the action to read after the prompt', function () {
    fakeRun(['passed' => false, 'output' => 'erro'], ['passed' => true, 'output' => 'ok']);

    $tool = new RunSpec;
    runSpec($tool);
    runSpec($tool);

    expect($tool->last()->passed)->toBeTrue()
        ->and($tool->last()->output)->toBe('ok');
});

it('keeps the storage state the run produced, which is what the auth setup exists to write', function () {
    fakeRun(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => []]]);

    $tool = new RunSpec;
    runSpec($tool);

    expect($tool->last()->storageState)->toBe(['cookies' => []]);
});

it('does not run the same spec twice, since the agent already ran it', function () {
    fakeRun(['passed' => true, 'output' => 'ok']);

    $tool = new RunSpec;
    $tool->ensure(SPEC_SOURCE);
    $tool->ensure(SPEC_SOURCE);

    Http::assertSentCount(1);
    expect($tool->attempts())->toBe(1);
});

it('runs again once the spec changed', function () {
    fakeRun(['passed' => false, 'output' => 'erro'], ['passed' => true, 'output' => 'ok']);

    $tool = new RunSpec;
    $tool->ensure(SPEC_SOURCE);
    $tool->ensure(SPEC_SOURCE."\n// corrigido");

    expect($tool->attempts())->toBe(2);
});

it('gives the action the same result the agent already got, without running again', function () {
    fakeRun(['passed' => true, 'output' => 'ok']);

    $tool = new RunSpec;
    runSpec($tool);

    expect($tool->ensure(SPEC_SOURCE)->passed)->toBeTrue();
    Http::assertSentCount(1);
});

it('tells the agent the webdriver is unreachable instead of throwing and killing the loop', function () {
    Http::fake(['*/runner/spec' => Http::response('', 500)]);

    $tool = new RunSpec;

    expect(runSpec($tool))->toContain('Não foi possível')
        ->and($tool->last())->toBeNull();
});

it('answers the tool contract the ai package expects', function () {
    $tool = new RunSpec;

    expect((string) $tool->description())->not->toBeEmpty()
        ->and($tool->schema(new JsonSchemaTypeFactory))->toHaveKey('spec');
});
