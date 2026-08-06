<?php

namespace App\Ai\Rules\Spec;

use App\Ai\Rules\Violation;
use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/**
 * Toda variável que o arquivo lê precisa existir e ter valor, senão o teste recebe undefined e
 * quebra. Os dois defeitos têm destinos diferentes: chave inventada é erro do modelo e volta
 * para o Fixer, chave vazia só o usuário preenche.
 */
final class EnvKeys
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        $violations = [];

        foreach ($playwright->envKeys() as $key) {
            if ($environments->has($key)) {
                if ($environments->isEmpty($key)) {
                    $violations[] = new Violation(
                        'env-sem-valor',
                        "A variável {$key} está declarada sem valor; preencha o ambiente ou o teste falha.",
                        fixable: false,
                    );
                }

                continue;
            }

            if (EnvKey::owns($key)) {
                continue;
            }

            $violations[] = new Violation(
                'env-desconhecida',
                "A variável {$key} não existe no ambiente; use uma das que foram declaradas.",
            );
        }

        return $violations;
    }
}
