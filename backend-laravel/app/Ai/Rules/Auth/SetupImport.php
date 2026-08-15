<?php

namespace App\Ai\Rules\Auth;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** O setup roda no projeto 'setup' do Playwright, e é o helper renomeado que o declara. */
final class SetupImport
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if ($playwright->matches('/import\s*\{[^}]*\btest\s+as\s+setup\b/')) {
            return [];
        }

        return [new Violation(
            'setup-import',
            "O arquivo de login importa o helper errado; use import { test as setup } from '@playwright/test'.",
        )];
    }
}
