<?php

use App\Ai\Rules\AuthRules;
use App\Ai\Rules\SpecRules;
use App\Support\Primitives\Playwright;
use App\Support\Recording;
use App\Support\Recording\SpecEmitter;

const EMIT_BASE = SPEC_BASE_URL;

function emitEvent(string $type, array $overrides = []): array
{
    return array_merge([
        'type' => $type,
        'timestamp' => 1000,
        'url' => EMIT_BASE.'/produtos',
        'selectors' => null,
        'label' => null,
        'value' => null,
        'sensitive' => false,
        'tagName' => null,
        'innerText' => null,
        'inputType' => null,
        'html' => null,
    ], $overrides);
}

function selectors(array $overrides = []): array
{
    return array_merge([
        'dataTestId' => null,
        'dataCy' => null,
        'ariaLabel' => null,
        'ariaRole' => null,
        'id' => null,
        'name' => null,
        'placeholder' => null,
        'cssStable' => null,
        'xpath' => null,
        'text' => null,
        'finder' => null,
    ], $overrides);
}

function emit(array $events, array $extraEnv = []): string
{
    return (new SpecEmitter(Recording::make($events), specUrl(), specEnvironments($extraEnv)))
        ->spec('Cadastro de produto', 'cria um produto')
        ->value;
}

it('opens the recording with a goto built from the base url variable', function () {
    $spec = emit([emitEvent('navigate', ['url' => EMIT_BASE.'/produtos'])]);

    expect($spec)->toContain('await page.goto(`${base}/produtos`)')
        ->and($spec)->toContain('const base = process.env.URL');
});

it('names the describe and the test from the title and the scenario given', function () {
    $spec = emit([emitEvent('navigate')]);

    expect($spec)->toContain("test.describe('Cadastro de produto'")
        ->and($spec)->toContain("test('cria um produto'");
});

it('turns a navigation that happened after the first one into a wait for the url segment', function () {
    $spec = emit([
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos/novo']),
    ]);

    expect(substr_count($spec, 'page.goto'))->toBe(1)
        ->and($spec)->toContain("await page.waitForURL('**novo**')");
});

it('ignores a navigation that landed on the url the page was already showing', function () {
    $spec = emit([
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
    ]);

    expect($spec)->not->toContain('waitForURL');
});

it('waits for a segment that carries a file extension', function () {
    $spec = emit([
        emitEvent('navigate', ['url' => EMIT_BASE.'/index.html']),
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos.html?busca=cadeira']),
    ]);

    expect($spec)->toContain("await page.waitForURL('**produtos.html**')");
});

it('never waits for a segment that the base url already carries, which would wait for nothing', function () {
    $spec = emit([
        emitEvent('navigate', ['url' => EMIT_BASE.'/login']),
        emitEvent('navigate', ['url' => EMIT_BASE.'/']),
    ]);

    expect($spec)->not->toContain('waitForURL')
        ->and($spec)->toContain('await page.goto(`${base}/login`)');
});

it('keeps track of the screen the page is on even when an iframe navigated in between', function () {
    $spec = emit([
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
        emitEvent('navigate', ['url' => 'https://www.facebook.com/tr/']),
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
    ]);

    expect($spec)->not->toContain('waitForURL');
});

it('ignores a navigation of another host, which is the pixel and the captcha iframe navigating alone', function () {
    $spec = emit([
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
        emitEvent('navigate', ['url' => 'https://www.facebook.com/tr/']),
        emitEvent('navigate', ['url' => 'https://www.google.com/recaptcha/api2/bframe?hl=pt-BR']),
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos/novo']),
    ]);

    expect($spec)->not->toContain('**tr**')
        ->and($spec)->not->toContain('bframe')
        ->and($spec)->toContain("await page.waitForURL('**novo**')");
});

it('waits for the segment before the identifier when the url ends in one', function () {
    $spec = emit([
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos/1042']),
    ]);

    expect($spec)->toContain("await page.waitForURL('**produtos**')");
});

it('waits for the element to be visible before clicking it', function () {
    $spec = emit([emitEvent('click', [
        'selectors' => selectors(['dataTestId' => 'salvar']),
        'label' => 'Salvar',
    ])]);

    expect($spec)->toContain("page.getByTestId('salvar')")
        ->and($spec)->toContain('await expect(alvo).toBeVisible()')
        ->and($spec)->toContain('await alvo.click()');
});

it('picks the stable css selector when the element has no test id', function () {
    $spec = emit([emitEvent('click', ['selectors' => selectors(['cssStable' => '#salvar'])])]);

    expect($spec)->toContain("page.locator('#salvar')");
});

it('prefers the text the recorder validated as unique over the generated css selector', function () {
    $spec = emit([emitEvent('click', ['selectors' => selectors([
        'text' => '/caminho/intranet',
        'finder' => '.text-sm:nth-child(2)',
    ])])]);

    expect($spec)->toContain("page.getByText('/caminho/intranet', { exact: true })")
        ->and($spec)->not->toContain('.text-sm');
});

it('falls back to the generated unique selector when nothing better was captured', function () {
    $spec = emit([emitEvent('click', ['selectors' => selectors(['finder' => 'main > .card:nth-child(2) button'])])]);

    expect($spec)->toContain("page.locator('main > .card:nth-child(2) button')");
});

it('skips an event whose element had no resolvable selector', function () {
    $spec = emit([
        emitEvent('navigate'),
        emitEvent('click', ['selectors' => selectors()]),
    ]);

    expect($spec)->not->toContain('.click()');
});

it('fills a text field with the recorded value', function () {
    $spec = emit([emitEvent('fill', [
        'selectors' => selectors(['dataTestId' => 'nome']),
        'label' => 'Nome',
        'value' => 'Cadeira de escritório',
        'tagName' => 'input',
        'inputType' => 'text',
    ])]);

    expect($spec)->toContain("await campo.fill('Cadeira de escritório')")
        ->and($spec)->toContain('await expect(campo).toBeVisible()');
});

it('selects the recorded option when the element is a select', function () {
    $spec = emit([emitEvent('fill', [
        'selectors' => selectors(['cssStable' => '#estado']),
        'value' => 'RS',
        'tagName' => 'select',
    ])]);

    expect($spec)->toContain("await campo.selectOption('RS')");
});

it('checks the box instead of typing into it when the element is a checkbox', function () {
    $spec = emit([emitEvent('fill', [
        'selectors' => selectors(['cssStable' => '#ativo']),
        'value' => 'on',
        'tagName' => 'input',
        'inputType' => 'checkbox',
        'checked' => true,
    ])]);

    expect($spec)->toContain('await campo.check()')
        ->and($spec)->not->toContain('.fill(');
});

it('unchecks the box that the recording left unchecked', function () {
    $spec = emit([emitEvent('fill', [
        'selectors' => selectors(['cssStable' => '#ativo']),
        'value' => 'on',
        'tagName' => 'input',
        'inputType' => 'checkbox',
        'checked' => false,
    ])]);

    expect($spec)->toContain('await campo.uncheck()');
});

it('drops the change that the click on the checkbox itself produced', function () {
    $spec = emit([
        emitEvent('click', ['selectors' => selectors(['cssStable' => '#presente']), 'label' => 'Embrulhar']),
        emitEvent('fill', [
            'selectors' => selectors(['cssStable' => '#presente']),
            'label' => 'Embrulhar',
            'value' => 'on',
            'tagName' => 'input',
            'inputType' => 'checkbox',
            'checked' => true,
        ]),
    ]);

    expect($spec)->toContain('await alvo.click()')
        ->and($spec)->not->toContain('.check()');
});

it('reads a value that the environment already holds from the variable instead of writing it down', function () {
    $spec = emit([emitEvent('fill', [
        'selectors' => selectors(['dataTestId' => 'usuario']),
        'value' => 'usuario-de-teste',
        'tagName' => 'input',
        'inputType' => 'text',
    ])]);

    expect($spec)->toContain('await campo.fill(process.env.AUTH_USER)')
        ->and($spec)->not->toContain('usuario-de-teste');
});

it('names a variable after the field label for a value the recorder marked as sensitive', function () {
    $events = [emitEvent('fill', [
        'selectors' => selectors(['dataTestId' => 'senha']),
        'label' => 'Senha de acesso',
        'value' => 'nao-sai-daqui',
        'sensitive' => true,
        'tagName' => 'input',
        'inputType' => 'password',
    ])];

    $emitter = new SpecEmitter(Recording::make($events), specUrl(), specEnvironments());

    expect($emitter->spec('t', 'c')->value)->toContain('await campo.fill(process.env.SENHA_DE_ACESSO)')
        ->and($emitter->envVars())->toBe(['SENHA_DE_ACESSO']);
});

it('drops the submit that the click on the button already fired', function () {
    $spec = emit([
        emitEvent('click', ['selectors' => selectors(['dataTestId' => 'salvar']), 'label' => 'Salvar']),
        emitEvent('submit', ['selectors' => selectors(['cssStable' => '#form'])]),
    ]);

    expect(substr_count($spec, 'await alvo.click()'))->toBe(1)
        ->and($spec)->not->toContain('Enter');
});

it('presses enter on the last filled field when the form was submitted without a click', function () {
    $spec = emit([
        emitEvent('fill', [
            'selectors' => selectors(['dataTestId' => 'busca']),
            'value' => 'cadeira',
            'tagName' => 'input',
            'inputType' => 'text',
        ]),
        emitEvent('submit', ['selectors' => selectors(['cssStable' => '#form'])]),
    ]);

    expect($spec)->toContain("await page.getByTestId('busca').press('Enter')");
});

it('names the step after the placeholder when the field carries no label', function () {
    $spec = emit([emitEvent('fill', [
        'selectors' => selectors(['dataTestId' => 'busca', 'placeholder' => 'Buscar projeto...']),
        'value' => 'intranet',
        'tagName' => 'input',
        'inputType' => 'text',
    ])]);

    expect($spec)->toContain("await test.step('Preencher Buscar projeto...'");
});

it('names the step without a dangling article when the element describes nothing', function () {
    $spec = emit([emitEvent('click', ['selectors' => selectors(['cssStable' => '#voltar'])])]);

    expect($spec)->toContain("await test.step('Clicar no elemento'");
});

it('hovers the element that was recorded in hover mode', function () {
    $spec = emit([emitEvent('hover', ['selectors' => selectors(['dataTestId' => 'menu']), 'label' => 'Menu'])]);

    expect($spec)->toContain('await alvo.hover()');
});

it('writes each assertion type with the matcher that fits it', function () {
    $spec = emit([
        emitEvent('assert', [
            'selectors' => selectors(['dataTestId' => 'titulo']),
            'assert' => ['assertType' => 'text', 'expectedValue' => 'Produtos'],
        ]),
        emitEvent('assert', [
            'selectors' => selectors(['dataTestId' => 'aviso']),
            'assert' => ['assertType' => 'hidden', 'expectedValue' => null],
        ]),
        emitEvent('assert', [
            'selectors' => selectors(['dataTestId' => 'total']),
            'assert' => ['assertType' => 'contains', 'expectedValue' => '3 itens'],
        ]),
    ]);

    expect($spec)->toContain("await expect(alvo).toHaveText('Produtos')")
        ->and($spec)->toContain('await expect(alvo).toBeHidden()')
        ->and($spec)->toContain("await expect(alvo).toContainText('3 itens')");
});

it('asserts the url by pattern of the segment, never by the whole address', function () {
    $spec = emit([emitEvent('assert', [
        'url' => EMIT_BASE.'/produtos/novo',
        'selectors' => selectors(['dataTestId' => 'x']),
        'assert' => ['assertType' => 'url', 'expectedValue' => EMIT_BASE.'/produtos/novo'],
    ])]);

    expect($spec)->toContain('await expect(page).toHaveURL(/novo/)');
});

it('gives the wait a longer deadline where the recording shows the user waited for the page', function () {
    $spec = emit([
        emitEvent('navigate', ['timestamp' => 1000]),
        emitEvent('click', [
            'timestamp' => 9000,
            'selectors' => selectors(['dataTestId' => 'salvar']),
        ]),
    ]);

    expect($spec)->toContain('await expect(alvo).toBeVisible({ timeout: 15000 })');
});

it('escapes a value that carries the quote the generated file uses', function () {
    $spec = emit([emitEvent('fill', [
        'selectors' => selectors(['dataTestId' => 'nome']),
        'value' => "Cadeira d'água",
        'tagName' => 'input',
        'inputType' => 'text',
    ])]);

    expect($spec)->toContain("await campo.fill('Cadeira d\\'água')");
});

it('breaks no rule that the generated file is checked against', function () {
    $spec = emit([
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
        emitEvent('click', ['selectors' => selectors(['dataTestId' => 'novo']), 'label' => 'Novo produto']),
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos/novo']),
        emitEvent('fill', [
            'url' => EMIT_BASE.'/produtos/novo',
            'selectors' => selectors(['cssStable' => '#nome']),
            'label' => 'Nome',
            'value' => 'Cadeira',
            'tagName' => 'input',
            'inputType' => 'text',
        ]),
        emitEvent('fill', [
            'url' => EMIT_BASE.'/produtos/novo',
            'selectors' => selectors(['dataTestId' => 'senha']),
            'label' => 'Senha',
            'value' => 'topsecret123',
            'sensitive' => true,
            'tagName' => 'input',
            'inputType' => 'password',
        ]),
        emitEvent('click', [
            'url' => EMIT_BASE.'/produtos/novo',
            'selectors' => selectors(['dataTestId' => 'salvar']),
            'label' => 'Salvar',
        ]),
        emitEvent('submit', ['url' => EMIT_BASE.'/produtos/novo', 'selectors' => selectors(['cssStable' => '#form'])]),
        emitEvent('navigate', ['url' => EMIT_BASE.'/produtos']),
        emitEvent('assert', [
            'selectors' => selectors(['dataTestId' => 'flash']),
            'assert' => ['assertType' => 'contains', 'expectedValue' => 'Produto criado'],
        ]),
    ]);

    $violations = SpecRules::check(new Playwright($spec), specUrl(), specEnvironments());

    expect(violated($violations))->toBe([]);
});

function login(array $extra = []): array
{
    return [
        emitEvent('navigate', ['url' => EMIT_BASE.'/login']),
        emitEvent('fill', [
            'url' => EMIT_BASE.'/login',
            'selectors' => selectors(['cssStable' => '#usuario']),
            'label' => 'Usuário',
            'value' => 'kauan',
            'tagName' => 'input',
            'inputType' => 'text',
        ]),
        emitEvent('fill', [
            'url' => EMIT_BASE.'/login',
            'selectors' => selectors(['cssStable' => '#senha']),
            'label' => 'Senha',
            'value' => 'topsecret123',
            'tagName' => 'input',
            'inputType' => 'password',
        ]),
        emitEvent('click', [
            'url' => EMIT_BASE.'/login',
            'selectors' => selectors(['dataTestId' => 'entrar']),
            'label' => 'Entrar',
        ]),
        ...$extra,
    ];
}

function emitAuth(array $events): string
{
    return (new SpecEmitter(Recording::make($events), specUrl(), specEnvironments()))->authSetup()->value;
}

it('writes the login file against the setup helper, not the test one', function () {
    $setup = emitAuth(login());

    expect($setup)->toContain("import { test as setup, expect } from '@playwright/test'")
        ->and($setup)->toContain("setup('autenticação'")
        ->and($setup)->toContain('await setup.step(')
        ->and($setup)->not->toContain('test.step(');
});

it('reads the credentials from the environment keys instead of writing them down', function () {
    $setup = emitAuth(login());

    expect($setup)->toContain('await campo.fill(process.env.AUTH_USER)')
        ->and($setup)->toContain('await campo.fill(process.env.AUTH_PASSWORD)')
        ->and($setup)->not->toContain('topsecret123')
        ->and($setup)->not->toContain('kauan');
});

it('closes the login by saving the session where the environment says', function () {
    $setup = emitAuth(login());

    expect($setup)->toContain("await page.context().storageState({ path: process.env.STORAGE_STATE || 'storage-state.json' })")
        ->and(strpos($setup, 'storageState('))->toBeGreaterThan(strpos($setup, 'AUTH_PASSWORD'));
});

it('lets the page settle before photographing the session, or it saves a half formed one', function () {
    $setup = emitAuth(login());

    expect($setup)->toContain("await page.waitForLoadState('load')")
        ->and(strpos($setup, 'storageState('))->toBeGreaterThan(strpos($setup, 'waitForLoadState'));
});

it('confirms the login by the screen the recording landed on', function () {
    $setup = emitAuth(login([emitEvent('navigate', ['url' => EMIT_BASE.'/painel'])]));

    expect($setup)->toContain("await page.waitForURL('**painel**')")
        ->and($setup)->toContain('await expect(page).toHaveURL(/painel/,');
});

it('confirms the login by the password field going away when the recording never navigated', function () {
    $setup = emitAuth(login());

    expect($setup)->toContain("await expect(page.locator('#senha')).toBeHidden(")
        ->and($setup)->not->toContain('toHaveURL');
});

it('confirms the login by the password field when the landing url says nothing the base does not', function () {
    $setup = emitAuth(login([emitEvent('navigate', ['url' => EMIT_BASE.'/'])]));

    expect($setup)->toContain("await expect(page.locator('#senha')).toBeHidden(")
        ->and($setup)->not->toContain('toHaveURL');
});

it('gives the login confirmation a deadline that fits a round trip to the server', function () {
    $setup = emitAuth(login([emitEvent('navigate', ['url' => EMIT_BASE.'/painel'])]));

    expect($setup)->toContain('await expect(page).toHaveURL(/painel/, { timeout: 15000 })');
});

it('never writes an early return, which would save a session that never logged in', function () {
    expect(emitAuth(login()))->not->toContain('return');
});

it('breaks no rule that the login file is checked against', function () {
    $violations = AuthRules::check(
        new Playwright(emitAuth(login([emitEvent('navigate', ['url' => EMIT_BASE.'/painel'])]))),
        specUrl(),
        specEnvironments(),
    );

    expect(violated($violations))->toBe([]);
});
