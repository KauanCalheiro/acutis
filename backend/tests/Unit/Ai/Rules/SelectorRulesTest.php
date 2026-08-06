<?php

use App\Ai\Rules\SelectorRules;
use App\Data\V1\Project\SelectorSuggestionData;

function suggestion(string $testId): SelectorSuggestionData
{
    return new SelectorSuggestionData(
        event: 'click em Entrar',
        currentSelector: '.btn-primary',
        suggestedTestId: $testId,
        reason: 'classe CSS pode mudar com estilização',
    );
}

it('finds nothing wrong with a testid in the resource-action pattern', function () {
    expect(SelectorRules::check([suggestion('login-entrar')]))->toBe([]);
});

it('accepts a testid with more than two segments', function () {
    expect(SelectorRules::check([suggestion('carrinho-remover-item')]))->toBe([]);
});

it('flags a testid written in camel case', function () {
    expect(violated(SelectorRules::check([suggestion('loginEntrar')])))->toContain('testid-kebab');
});

it('flags a testid with an uppercase letter', function () {
    expect(violated(SelectorRules::check([suggestion('Login-Entrar')])))->toContain('testid-kebab');
});

it('flags a testid with a space', function () {
    expect(violated(SelectorRules::check([suggestion('login entrar')])))->toContain('testid-kebab');
});

it('flags a single word testid, which names no action', function () {
    expect(violated(SelectorRules::check([suggestion('entrar')])))->toContain('testid-recurso-acao');
});

it('reports the offending testid in the message, so the fixer knows which one to redo', function () {
    $violation = collect(SelectorRules::check([suggestion('loginEntrar')]))->first();

    expect($violation->message)->toContain('loginEntrar');
});

it('checks every suggestion, not just the first', function () {
    $violations = SelectorRules::check([
        suggestion('login-entrar'),
        suggestion('loginSair'),
    ]);

    expect(violated($violations))->toBe(['testid-kebab']);
});
