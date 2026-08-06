<?php

namespace App\Ai\Rules;

use App\Ai\Rules\Spec\ActionAwait;
use App\Ai\Rules\Spec\Comment;
use App\Ai\Rules\Spec\EnvKeys;
use App\Ai\Rules\Spec\ExactUrl;
use App\Ai\Rules\Spec\FixedWait;
use App\Ai\Rules\Spec\ForeignImport;
use App\Ai\Rules\Spec\GlobSegment;
use App\Ai\Rules\Spec\Host;
use App\Ai\Rules\Spec\LiteralValue;
use App\Ai\Rules\Spec\Marker;
use App\Ai\Rules\Spec\Mask;
use App\Ai\Rules\Spec\RepeatedSegment;
use App\Ai\Rules\Spec\Scheme;
use App\Ai\Rules\Spec\StepAwait;
use App\Ai\Rules\Spec\TrailingSlash;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * As regras que valem para qualquer arquivo Playwright que a IA escreve, de cenário ou de login.
 * Toda uma delas já esteve em prosa no prompt de algum agente: lá competia por atenção com as
 * outras vinte e falhava calada. Tirar uma daqui é apagar uma linha.
 */
final class SpecRules
{
    /** @var list<class-string> */
    private const RULES = [
        Host::class,
        Scheme::class,
        ExactUrl::class,
        GlobSegment::class,
        TrailingSlash::class,
        FixedWait::class,
        RepeatedSegment::class,
        ForeignImport::class,
        Comment::class,
        StepAwait::class,
        ActionAwait::class,
        Mask::class,
        Marker::class,
        EnvKeys::class,
        LiteralValue::class,
    ];

    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        return array_merge(...array_map(
            fn (string $rule): array => $rule::check($playwright, $base, $environments),
            self::RULES,
        ));
    }
}
