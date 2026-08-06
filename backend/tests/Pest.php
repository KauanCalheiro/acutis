<?php

use App\Ai\Rules\Violation;
use App\Data\V1\Project\EnvironmentVarData;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Url;
use Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature', 'Unit/Ai/Tools');

/** A URL base usada nas fixtures de spec, com caminho para pegar segmento repetido. */
const SPEC_BASE_URL = 'https://sistema.test/intranet';

/** O payload estruturado que o agente recebeu, já decodificado. */
function promptPayload(object $prompt): array
{
    return json_decode($prompt->prompt, true) ?? [];
}

/**
 * O ambiente ativo das fixtures: uma não-secreta com valor e uma secreta sem.
 *
 * @param  list<EnvironmentVarData>  $extra
 * @return list<EnvironmentVarData>
 */
function specEnvironment(array $extra = []): array
{
    return [
        new EnvironmentVarData('URL', SPEC_BASE_URL),
        new EnvironmentVarData('AUTH_USER', 'usuario-de-teste'),
        new EnvironmentVarData('AUTH_PASSWORD', 'topsecret123', secret: true),
        ...$extra,
    ];
}

function specUrl(): Url
{
    return new Url(SPEC_BASE_URL);
}

/**
 * O ambiente das fixtures no tipo que percorre regras, tools e payloads.
 *
 * @param  list<EnvironmentVarData>  $extra
 */
function specEnvironments(array $extra = []): Environments
{
    return new Environments(specEnvironment($extra));
}

/**
 * Os slugs das regras violadas, na ordem em que saíram.
 *
 * @param  list<Violation>  $violations
 * @return list<string>
 */
function violated(array $violations): array
{
    return array_column($violations, 'rule');
}
