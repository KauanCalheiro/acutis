<?php

use App\Ai\Rules\AuthRules;
use App\Support\Primitives\Playwright;

function cleanAuthSetup(string $body = ''): string
{
    $body = $body ?: <<<'TS'
            await page.context().storageState({ path: process.env.STORAGE_STATE || 'storage-state.json' })
    TS;

    return <<<TS
    import { test as setup, expect } from '@playwright/test'

    const base = process.env.URL

    setup('autentica no sistema', async ({ page }) => {
        await setup.step('abrir a tela de login', async () => {
            await page.goto(`\${base}/login`)
        })

        await setup.step('preencher as credenciais', async () => {
            await page.getByTestId('user').fill(process.env.AUTH_USER)
            await page.getByTestId('pass').fill(process.env.AUTH_PASSWORD)
        })

        await setup.step('confirmar que autenticou', async () => {
            await page.getByTestId('entrar').click()
            await page.waitForURL('**intranet**')
            await expect(page).toHaveURL(/intranet/)
        })

    {$body}
    })
    TS;
}

function checkAuthSetup(string $spec): array
{
    return AuthRules::check(new Playwright($spec), specUrl(), specEnvironments());
}

it('finds nothing wrong with an auth setup that follows every rule', function () {
    expect(checkAuthSetup(cleanAuthSetup()))->toBe([]);
});

it('flags an auth setup that never saves the session, leaving every scenario logged out', function () {
    $violations = checkAuthSetup(cleanAuthSetup('    await page.close()'));

    expect(violated($violations))->toContain('storage-state-ausente');
});

it('flags an auth setup that imports the plain test helper instead of the setup helper', function () {
    $spec = str_replace('test as setup', 'test', cleanAuthSetup());

    expect(violated(checkAuthSetup($spec)))->toContain('setup-import');
});

it('flags a setup that saves the session and returns before logging in', function () {
    $spec = str_replace(
        "    await setup.step('abrir a tela de login', async () => {",
        <<<'TS'
            if (!process.env.AUTH_USER) {
                await page.context().storageState({ path: 'storage-state.json' })

                return
            }

            await setup.step('abrir a tela de login', async () => {
        TS,
        cleanAuthSetup(),
    );

    expect(violated(checkAuthSetup($spec)))->toContain('login-contornado');
});

it('flags any early return in the setup, since it means the login did not happen', function () {
    $spec = str_replace(
        "    await setup.step('abrir a tela de login', async () => {",
        "    if (process.env.CI) return\n\n    await setup.step('abrir a tela de login', async () => {",
        cleanAuthSetup(),
    );

    expect(violated(checkAuthSetup($spec)))->toContain('login-contornado');
});

it('flags a return however deep it sits, since a setup that logs in needs none', function () {
    $spec = str_replace(
        '        await page.goto(`${base}/login`)',
        "        await page.goto(`\${base}/login`)\n            if (!process.env.AUTH_USER) return",
        cleanAuthSetup(),
    );

    expect(violated(checkAuthSetup($spec)))->toContain('login-contornado');
});

it('finds nothing to flag in a setup that simply runs to the end', function () {
    expect(violated(checkAuthSetup(cleanAuthSetup())))->not->toContain('login-contornado');
});

it('carries every shared spec rule, so the auth setup is held to the same bar', function () {
    $spec = str_replace(
        'await page.goto(`${base}/login`)',
        'await page.goto("https://sistema.test/intranet/login")',
        cleanAuthSetup(),
    );

    expect(violated(checkAuthSetup($spec)))->toContain('host-literal');
});
