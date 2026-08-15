<?php

namespace App\Ai\Rules\Selector;

use App\Ai\Rules\Violation;
use App\Data\V1\Project\SelectorSuggestionData;

/** O data-testid entra no código do sistema testado, então segue um padrão só. */
final class Kebab
{
    public const PATTERN = '/^[a-z0-9]+(-[a-z0-9]+)*$/';

    /**
     * @param  list<SelectorSuggestionData>  $suggestions
     * @return list<Violation>
     */
    public static function check(array $suggestions): array
    {
        $violations = [];

        foreach ($suggestions as $suggestion) {
            if (preg_match(self::PATTERN, $suggestion->suggestedTestId) === 1) {
                continue;
            }

            $violations[] = new Violation(
                'testid-kebab',
                "O data-testid {$suggestion->suggestedTestId} não está em kebab-case minúsculo.",
            );
        }

        return $violations;
    }
}
