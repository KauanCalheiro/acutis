<?php

use App\Ai\Agents\Auth\AuthFixer;
use App\Ai\Limits;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\ObjectSchema;

/** Toda classe de agente, descoberta pelo disco, para um agente novo entrar no teste sozinho. */
function agentClasses(): array
{
    $root = __DIR__.'/../../../app/Ai/Agents';

    return array_map(
        fn (string $file): string => 'App\\Ai\\Agents\\'.str_replace(
            ['/', '.php'],
            ['\\', ''],
            substr($file, strlen($root) + 1),
        ),
        glob($root.'/*/*.php') ?: [],
    );
}

/** Só os que devolvem objeto: são esses que dependem do schema para chegar inteiros. */
function structuredAgentClasses(): array
{
    return array_values(array_filter(
        agentClasses(),
        fn (string $agent): bool => is_subclass_of($agent, HasStructuredOutput::class),
    ));
}

/**
 * Os objetos do schema cujo `required` não cobre tudo que eles declaram, pelo caminho onde estão.
 *
 * @return list<string>
 */
function fieldsLeftOptional(array $schema, string $path = 'raiz'): array
{
    $gaps = [];

    if (($schema['type'] ?? null) === 'object') {
        $missing = array_diff(array_keys($schema['properties'] ?? []), $schema['required'] ?? []);

        if ($missing !== []) {
            $gaps[] = $path.': '.implode(', ', $missing);
        }

        foreach ($schema['properties'] ?? [] as $key => $property) {
            $gaps = [...$gaps, ...fieldsLeftOptional($property, "{$path}.{$key}")];
        }
    }

    if (is_array($schema['items'] ?? null)) {
        $gaps = [...$gaps, ...fieldsLeftOptional($schema['items'], "{$path}[]")];
    }

    return $gaps;
}

it('finds the agents on disk', function () {
    expect(agentClasses())->toContain(AuthFixer::class);
});

it('finds the agents that answer with an object', function () {
    expect(structuredAgentClasses())->not->toBeEmpty();
});

/**
 * Campo sem `required` é campo que o modelo pode calar. O Ollama monta a gramática da resposta
 * exatamente com o que o schema pede, e um modelo local devolveu a sugestão sem o data-testid —
 * só a justificativa. Todo campo declarado aqui é campo que quem chama vai ler.
 */
it('marks every field of the structured output as required', function (string $agent) {
    $schema = (new ObjectSchema(app($agent)->schema(new JsonSchemaTypeFactory)))->toSchema();

    expect(fieldsLeftOptional($schema))->toBe([]);
})->with(structuredAgentClasses());

it('gives every agent the same timeout, since 60s does not cover a real generation', function (string $agent) {
    $attributes = (new ReflectionClass($agent))->getAttributes(Timeout::class);

    expect($attributes)->not->toBeEmpty()
        ->and($attributes[0]->newInstance()->value)->toBe(Limits::TIMEOUT);
})->with(agentClasses());

/**
 * Nenhum agente pede ferramenta: cada um recebe o prompt inteiro e devolve a resposta numa
 * interação. Foi o laço de tools que trouxe a complexidade que este projeto não quer, e é a Action
 * que orquestra execução e correção, onde o limite é código e não conversa.
 */
it('keeps every agent on a single call, with no tool loop to spend itself in', function (string $agent) {
    expect(is_subclass_of($agent, HasTools::class))->toBeFalse();
})->with(agentClasses());
