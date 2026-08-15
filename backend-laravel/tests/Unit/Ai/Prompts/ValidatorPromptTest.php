<?php

use App\Ai\Prompts\ValidatorPrompt;

function validatorPayload(array $arguments = []): array
{
    return json_decode(ValidatorPrompt::of(...array_merge([
        'spec' => "import { test } from '@playwright/test'",
        'events' => [['type' => 'click', 'label' => 'Entrar']],
    ], $arguments)), true);
}

it('builds a payload that is valid json', function () {
    expect(validatorPayload())->toBeArray();
});

it('carries the spec under judgement and the events it should reproduce', function () {
    $payload = validatorPayload();

    expect($payload['spec'])->toContain('@playwright/test')
        ->and($payload['events'])->toBe([['type' => 'click', 'label' => 'Entrar']]);
});

it('leaves out the gherkin when the flow has none to compare against', function () {
    expect(validatorPayload())->not->toHaveKey('gherkin');
});

it('carries the gherkin when there is one, since it is the intent to check against', function () {
    $payload = validatorPayload(['gherkin' => "@read\nFuncionalidade: Consulta de produtos"]);

    expect($payload['gherkin'])->toContain('Consulta de produtos');
});
