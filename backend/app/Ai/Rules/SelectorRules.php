<?php

namespace App\Ai\Rules;

use App\Ai\Rules\Selector\Kebab;
use App\Ai\Rules\Selector\ResourceAction;
use App\Data\V1\Project\SelectorSuggestionData;

/** O data-testid sugerido entra no código do sistema testado, então o padrão é conferido antes. */
final class SelectorRules
{
    /** @var list<class-string> */
    private const RULES = [
        Kebab::class,
        ResourceAction::class,
    ];

    /**
     * @param  list<SelectorSuggestionData>  $suggestions
     * @return list<Violation>
     */
    public static function check(array $suggestions): array
    {
        return array_merge(...array_map(
            fn (string $rule): array => $rule::check($suggestions),
            self::RULES,
        ));
    }
}
