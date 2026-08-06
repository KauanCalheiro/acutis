<?php

use App\Ai\Rules\SpecRules;
use App\Ai\Rules\Violation;
use App\Ai\Tools\CheckRules;
use App\Support\Primitives\Playwright;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Laravel\Ai\Tools\Request;

function checkRulesTool(?Closure $check = null): CheckRules
{
    return new CheckRules($check ?? fn (string $spec): array => SpecRules::check(
        new Playwright($spec),
        specUrl(),
        specEnvironments(),
    ));
}

it('tells the agent the spec is clean when no rule was broken', function () {
    $answer = checkRulesTool(fn (): array => [])->handle(new Request(['spec' => 'qualquer coisa']));

    expect($answer)->toContain('Nenhuma regra quebrada');
});

it('hands the agent every broken rule with the message that says how to fix it', function () {
    $violations = [
        new Violation('url-exata', 'toHaveURL com string exata na linha 14'),
        new Violation('espera-fixa', 'waitForTimeout na linha 9'),
    ];

    $answer = checkRulesTool(fn (): array => $violations)->handle(new Request(['spec' => 'x']));

    expect($answer)->toContain('url-exata')
        ->and($answer)->toContain('toHaveURL com string exata na linha 14')
        ->and($answer)->toContain('espera-fixa');
});

it('runs the rules against the spec the agent is holding, not against a stored one', function () {
    $seen = null;

    checkRulesTool(function (string $spec) use (&$seen): array {
        $seen = $spec;

        return [];
    })->handle(new Request(['spec' => 'o spec que o agente mandou']));

    expect($seen)->toBe('o spec que o agente mandou');
});

it('answers the tool contract the ai package expects', function () {
    $tool = checkRulesTool();

    expect((string) $tool->description())->not->toBeEmpty()
        ->and($tool->schema(new JsonSchemaTypeFactory))->toHaveKey('spec');
});
