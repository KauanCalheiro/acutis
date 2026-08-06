<?php

use App\Ai\Prompts\FixPrompt;
use App\Ai\Rules\Violation;

function fixPayload(array $arguments = []): array
{
    return json_decode(FixPrompt::of(...array_merge([
        'spec' => "import { test } from '@playwright/test'",
        'violations' => [new Violation('url-exata', 'toHaveURL com string exata na linha 14')],
    ], $arguments)), true);
}

it('builds a payload that is valid json', function () {
    expect(fixPayload())->toBeArray();
});

it('carries the spec that has to be fixed', function () {
    expect(fixPayload()['spec'])->toContain('@playwright/test');
});

it('carries each violation as a rule and a message, never as prose', function () {
    expect(fixPayload()['violations'])->toBe([
        ['rule' => 'url-exata', 'message' => 'toHaveURL com string exata na linha 14'],
    ]);
});

it('drops the routing flag, which tells the model nothing it can act on', function () {
    $violations = [new Violation('env-sem-valor', 'BASE_AUTH está vazia', fixable: false)];

    expect(fixPayload(['violations' => $violations])['violations'][0])->not->toHaveKey('fixable');
});

it('leaves out the run section when the fix came from validation alone', function () {
    expect(fixPayload())->not->toHaveKey('run');
});

it('carries the failed step and the error when the fix came from a real run', function () {
    $payload = fixPayload([
        'step' => 'preencher as credenciais',
        'error' => 'locator.fill: Timeout 30000ms exceeded',
    ]);

    expect($payload['run'])->toBe([
        'step' => 'preencher as credenciais',
        'error' => 'locator.fill: Timeout 30000ms exceeded',
    ]);
});

it('leaves out the snapshot section when no page was captured', function () {
    expect(fixPayload())->not->toHaveKey('snapshot');
});

it('carries the snapshot of the real page when there is one', function () {
    $payload = fixPayload(['snapshot' => ['role' => 'button', 'name' => 'Entrar']]);

    expect($payload['snapshot'])->toBe(['role' => 'button', 'name' => 'Entrar']);
});

it('leaves out the events section when the caller has none to give', function () {
    expect(fixPayload())->not->toHaveKey('events');
});

it('carries the original events so the fixer can confirm the intent of the step', function () {
    $payload = fixPayload(['events' => [['type' => 'click', 'label' => 'Entrar']]]);

    expect($payload['events'])->toBe([['type' => 'click', 'label' => 'Entrar']]);
});
