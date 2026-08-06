<?php

namespace App\Ai\Rules;

use App\Ai\Rules\Auth\SetupImport;
use App\Ai\Rules\Auth\StorageState;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** O auth.setup.ts é um spec como os outros, mais o que só o login tem de errar. */
final class AuthRules
{
    /** @var list<class-string> */
    private const RULES = [
        StorageState::class,
        SetupImport::class,
    ];

    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        return array_merge(
            SpecRules::check($playwright, $base, $environments),
            ...array_map(
                fn (string $rule): array => $rule::check($playwright, $base, $environments),
                self::RULES,
            ),
        );
    }
}
