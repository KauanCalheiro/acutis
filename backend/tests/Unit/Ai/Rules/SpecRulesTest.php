<?php

use App\Ai\Rules\SpecRules;
use App\Data\V1\Project\EnvironmentVarData;
use App\Support\Primitives\Playwright;
use App\Support\Recording;

function cleanSpec(string $body = ''): string
{
    $body = $body ?: <<<'TS'
                await page.goto(`${base}/produtos`)
                await expect(page).toHaveURL(/\/produtos/)
    TS;

    return <<<TS
    import { test, expect } from '@playwright/test'

    const base = process.env.URL

    test.describe('Consulta de produtos', { tag: ['@read'] }, () => {
        test('lista os produtos', async ({ page }) => {
            await test.step('abrir a listagem', async () => {
    {$body}
            })
        })
    })
    TS;
}

function checkSpec(string $spec, array $extra = []): array
{
    return SpecRules::check(new Playwright($spec), specUrl(), specEnvironments($extra));
}

it('finds nothing wrong with a spec that follows every rule', function () {
    expect(checkSpec(cleanSpec()))->toBe([]);
});

it('flags the base url host written literally in the spec', function () {
    $violations = checkSpec(cleanSpec('            await page.goto("https://sistema.test/intranet/produtos")'));

    expect(violated($violations))->toContain('host-literal');
});

it('flags a url assertion made by exact string instead of pattern', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await expect(page).toHaveURL(`${base}/produtos`)
    TS));

    expect(violated($violations))->toContain('url-exata');
});

it('accepts a url assertion made by regular expression', function () {
    expect(violated(checkSpec(cleanSpec())))->not->toContain('url-exata');
});

it('flags a fixed time wait', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.waitForTimeout(3000)
    TS));

    expect(violated($violations))->toContain('espera-fixa');
});

it('flags the base url path repeated after the base url variable', function () {
    $violations = checkSpec(cleanSpec('            await page.goto(`${base}/intranet/produtos`)'));

    expect(violated($violations))->toContain('segmento-repetido');
});

it('accepts the base url path inside a wait pattern, where it belongs', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.waitForURL('**intranet**')
    TS));

    expect(violated($violations))->not->toContain('segmento-repetido');
});

it('accepts a wait pattern that fences a single segment on both sides', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.waitForURL('**produtos**')
    TS));

    expect($violations)->toBe([]);
});

it('flags a wait pattern anchored at the end, which a query string breaks', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.waitForURL('**/produtos')
    TS));

    expect(violated($violations))->toContain('url-glob-frouxo');
});

it('flags a wait pattern that demands the trailing slash', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.waitForURL('**produtos/**')
    TS));

    expect(violated($violations))->toContain('url-glob-frouxo');
});

it('flags a wait pattern that ties the whole path instead of the last segment', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.waitForURL('**pedidos/produtos**')
    TS));

    expect(violated($violations))->toContain('url-glob-frouxo');
});

it('flags a url regex that demands the trailing slash', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await expect(page).toHaveURL(/\/produtos\//)
    TS));

    expect(violated($violations))->toContain('barra-final');
});

it('accepts a url regex that matches with and without the trailing slash', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await expect(page).toHaveURL(/produtos/)
    TS));

    expect(violated($violations))->not->toContain('barra-final');
});

it('flags an import from anywhere other than the playwright package', function () {
    $spec = "import { faker } from '@faker-js/faker'\n".cleanSpec();

    expect(violated(checkSpec($spec)))->toContain('import-externo');
});

it('flags an env key the environment never declared', function () {
    $violations = checkSpec(str_replace('process.env.URL', 'process.env.BASE_URL', cleanSpec()));

    $violation = collect($violations)->firstWhere('rule', 'env-desconhecida');

    expect($violation)->not->toBeNull()
        ->and($violation->message)->toContain('BASE_URL')
        ->and($violation->fixable)->toBeTrue();
});

it('allows the keys acutis owns even when the environment does not declare them', function () {
    $spec = str_replace('process.env.URL', 'process.env.STORAGE_STATE', cleanSpec());

    expect(violated(checkSpec($spec)))->not->toContain('env-desconhecida');
});

it('flags a declared key whose value is empty, and leaves it for the user to fill', function () {
    $spec = str_replace('process.env.URL', 'process.env.BASE_AUTH', cleanSpec());

    $violations = checkSpec($spec, [new EnvironmentVarData('BASE_AUTH', '')]);

    $violation = collect($violations)->firstWhere('rule', 'env-sem-valor');

    expect($violation)->not->toBeNull()
        ->and($violation->message)->toContain('BASE_AUTH')
        ->and($violation->fixable)->toBeFalse();
});

it('flags a non secret environment value written literally instead of through process.env', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.getByTestId('user').fill('usuario-de-teste')
    TS));

    $violation = collect($violations)->firstWhere('rule', 'valor-literal');

    expect($violation)->not->toBeNull()
        ->and($violation->message)->toContain('AUTH_USER');
});

it('never reports a secret value, because the secret value never reaches the rules', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.getByTestId('pass').fill('topsecret123')
    TS));

    expect(violated($violations))->not->toContain('valor-literal');
});

it('ignores a short environment value, which would match anywhere by accident', function () {
    $violations = checkSpec(cleanSpec(), [new EnvironmentVarData('PAGINA', 'pro')]);

    expect(violated($violations))->not->toContain('valor-literal');
});

it('flags a step that was not awaited, which would run it in parallel and fail', function () {
    $spec = str_replace("await test.step('abrir a listagem'", "test.step('abrir a listagem'", cleanSpec());

    expect(violated(checkSpec($spec)))->toContain('step-sem-await');
});

it('accepts a step that was awaited', function () {
    expect(violated(checkSpec(cleanSpec())))->not->toContain('step-sem-await');
});

it('flags a navigation that was not awaited', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                page.goto(`${base}/produtos`)
    TS));

    expect(violated($violations))->toContain('acao-sem-await');
});

it('flags an inline comment left in the generated spec', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                // abre a listagem de produtos
                await page.goto(`${base}/produtos`)
    TS));

    expect(violated($violations))->toContain('comentario-inline');
});

it('flags a block comment too', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                /* abre a listagem */
                await page.goto(`${base}/produtos`)
    TS));

    expect(violated($violations))->toContain('comentario-inline');
});

it('never mistakes a url inside a string for a comment', function () {
    $violations = checkSpec(cleanSpec(<<<'TS'
                await page.goto(`${base}/produtos`)
                await page.waitForURL('**/produtos')
    TS));

    expect(violated($violations))->not->toContain('comentario-inline');
});

it('flags the mask copied straight into the spec, which would type bullets into the field', function () {
    $violations = checkSpec(cleanSpec(
        "            await page.getByTestId('pass').fill('".Recording::MASK."')",
    ));

    expect(violated($violations))->toContain('mascara-no-spec');
});

it('flags an environment marker copied straight into the spec instead of resolved to process.env', function () {
    $violations = checkSpec(cleanSpec(
        "            await page.getByTestId('user').fill('{{AUTH_USER}}')",
    ));

    expect(violated($violations))->toContain('marcador-no-spec');
});
