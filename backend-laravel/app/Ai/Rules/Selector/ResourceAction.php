<?php

namespace App\Ai\Rules\Selector;

use App\Ai\Rules\Violation;
use App\Data\V1\Project\SelectorSuggestionData;

/**
 * O padrão é <recurso>-<acao>: uma palavra só nomeia o elemento sem dizer o que ele faz, e dois
 * botões da mesma tela acabam disputando o mesmo testid. Quem está fora do kebab é acusado pela
 * Kebab, então aqui passa só o que já sobreviveu a ela.
 */
final class ResourceAction
{
    /**
     * @param  list<SelectorSuggestionData>  $suggestions
     * @return list<Violation>
     */
    public static function check(array $suggestions): array
    {
        $violations = [];

        foreach ($suggestions as $suggestion) {
            $testId = $suggestion->suggestedTestId;

            if (preg_match(Kebab::PATTERN, $testId) !== 1 || str_contains($testId, '-')) {
                continue;
            }

            $violations[] = new Violation(
                'testid-recurso-acao',
                "O data-testid {$testId} não nomeia recurso e ação; use <recurso>-<acao>.",
            );
        }

        return $violations;
    }
}
