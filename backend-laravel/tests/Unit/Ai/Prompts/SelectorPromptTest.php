<?php

use App\Ai\Prompts\SelectorPrompt;

function selectorEvent(array $selectors, string $label = 'Entrar'): array
{
    return [
        'type' => 'click',
        'timestamp' => 1000,
        'url' => 'https://sistema.test/intranet/login',
        'selectors' => $selectors,
        'label' => $label,
        'value' => null,
        'inputType' => null,
    ];
}

function selectorTargets(array $events): array
{
    return json_decode(SelectorPrompt::from($events), true);
}

it('keeps only the events whose selector is fragile', function () {
    $targets = selectorTargets([
        selectorEvent(['dataTestId' => 'login-entrar']),
        selectorEvent(['cssStable' => '.btn-primary'], 'Sair'),
    ]);

    expect($targets)->toHaveCount(1)
        ->and($targets[0]['label'])->toBe('Sair');
});

it('drops an event that carries no selector at all', function () {
    expect(selectorTargets([selectorEvent([])]))->toBe([]);
});

it('returns an empty payload when every element already has a testid', function () {
    expect(selectorTargets([selectorEvent(['dataTestId' => 'login-entrar'])]))->toBe([]);
});

it('prefers the id over the css class when resolving the fragile selector', function () {
    $targets = selectorTargets([selectorEvent(['id' => '#v-0', 'cssStable' => '.btn-primary'])]);

    expect($targets[0]['selector'])->toBe('#v-0');
});

it('falls back to the css class when there is no id', function () {
    $targets = selectorTargets([selectorEvent(['cssStable' => '.btn-primary', 'text' => 'Entrar'])]);

    expect($targets[0]['selector'])->toBe('.btn-primary');
});

it('falls back to the text when there is neither id nor css class', function () {
    $targets = selectorTargets([selectorEvent(['text' => 'Entrar'])]);

    expect($targets[0]['selector'])->toBe('Entrar');
});

it('numbers each target so the suggestion comes back attached to its event', function () {
    $targets = selectorTargets([
        selectorEvent(['dataTestId' => 'ja-tem']),
        selectorEvent(['cssStable' => '.btn-primary'], 'Sair'),
        selectorEvent(['text' => 'Salvar'], 'Salvar'),
    ]);

    expect(array_column($targets, 'index'))->toBe([1, 2]);
});

it('sends the type and the label, which is what names the resource and the action', function () {
    $targets = selectorTargets([selectorEvent(['cssStable' => '.btn-primary'], 'Entrar')]);

    expect($targets[0])->toBe([
        'index' => 0,
        'type' => 'click',
        'label' => 'Entrar',
        'selector' => '.btn-primary',
    ]);
});
