<?php

use App\Ai\SpecRunner;
use App\Enums\EnvKey;
use Illuminate\Support\Facades\Http;

const SPEC_SOURCE = "import { test } from '@playwright/test'";

function fakeRun(array ...$responses): void
{
    $sequence = Http::sequence();

    foreach ($responses as $body) {
        $sequence->push($body);
    }

    Http::fake(['*/runner/spec' => $sequence]);
}

it('tells the action the spec passed', function () {
    fakeRun(['passed' => true, 'output' => '1 passed']);

    expect((new SpecRunner)->ensure(SPEC_SOURCE)->passed)->toBeTrue();
});

it('hands over the failure output, which is what the fixer needs to fix the spec', function () {
    fakeRun(['passed' => false, 'output' => 'locator.click: Timeout 30000ms exceeded']);

    expect((new SpecRunner)->ensure(SPEC_SOURCE)->output)->toContain('Timeout 30000ms exceeded');
});

it('sends the spec, the execution url and the environment to the webdriver', function () {
    fakeRun(['passed' => true, 'output' => '']);

    (new SpecRunner('https://execucao.test', [EnvKey::URL->value => 'https://execucao.test']))->ensure(SPEC_SOURCE);

    Http::assertSent(fn ($request) => $request['spec'] === SPEC_SOURCE
        && $request['baseUrl'] === 'https://execucao.test'
        && $request['env'] === ['URL' => 'https://execucao.test']);
});

it('counts how many times the spec ran, so the action can report the attempts', function () {
    fakeRun(['passed' => false, 'output' => 'erro'], ['passed' => true, 'output' => 'ok']);

    $runner = new SpecRunner;
    $runner->ensure(SPEC_SOURCE);
    $runner->ensure(SPEC_SOURCE."\n// corrigido");

    expect($runner->attempts())->toBe(2);
});

it('has no attempts before anything ran', function () {
    expect((new SpecRunner)->attempts())->toBe(0);
});

it('keeps the last result for the action to read after the loop', function () {
    fakeRun(['passed' => false, 'output' => 'erro'], ['passed' => true, 'output' => 'ok']);

    $runner = new SpecRunner;
    $runner->ensure(SPEC_SOURCE);
    $runner->ensure(SPEC_SOURCE."\n// corrigido");

    expect($runner->last()->passed)->toBeTrue()
        ->and($runner->last()->output)->toBe('ok');
});

it('keeps the html of the broken page, which is what shows the element that changed', function () {
    fakeRun(['passed' => false, 'output' => 'erro', 'html' => '<button data-testid="salvar-pedido">Salvar</button>']);

    $runner = new SpecRunner;
    $runner->ensure(SPEC_SOURCE);

    expect($runner->last()->html)->toContain('salvar-pedido');
});

it('has no html when the run passed, because there is no broken page to look at', function () {
    fakeRun(['passed' => true, 'output' => 'ok']);

    $runner = new SpecRunner;
    $runner->ensure(SPEC_SOURCE);

    expect($runner->last()->html)->toBeNull();
});

it('keeps the storage state the run produced, which is what the auth setup exists to write', function () {
    fakeRun(['passed' => true, 'output' => 'ok', 'storageState' => ['cookies' => []]]);

    $runner = new SpecRunner;
    $runner->ensure(SPEC_SOURCE);

    expect($runner->last()->storageState)->toBe(['cookies' => []]);
});

it('does not run the same spec twice, since the loop asks again for every round', function () {
    fakeRun(['passed' => true, 'output' => 'ok']);

    $runner = new SpecRunner;
    $runner->ensure(SPEC_SOURCE);
    $runner->ensure(SPEC_SOURCE);

    Http::assertSentCount(1);
    expect($runner->attempts())->toBe(1);
});

it('runs again once the spec changed', function () {
    fakeRun(['passed' => false, 'output' => 'erro'], ['passed' => true, 'output' => 'ok']);

    $runner = new SpecRunner;
    $runner->ensure(SPEC_SOURCE);
    $runner->ensure(SPEC_SOURCE."\n// corrigido");

    expect($runner->attempts())->toBe(2);
});

it('reports nothing when the webdriver is unreachable, instead of throwing and killing the action', function () {
    Http::fake(['*/runner/spec' => Http::response('', 500)]);

    $runner = new SpecRunner;

    expect($runner->ensure(SPEC_SOURCE))->toBeNull()
        ->and($runner->last())->toBeNull();
});
