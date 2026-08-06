<?php

namespace App\Ai\Agents\Auth;

use App\Ai\Limits;
use App\Ai\Prompts\ValidatorPrompt;
use App\Ai\Rules\Violation;
use App\Ai\StructuredOutput;
use App\Support\Primitives\Playwright;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Attributes\UseCheapestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

/**
 * A camada que as regras não alcançam: se o arquivo faz mesmo o login que foi gravado. Regex
 * confere forma, isto confere intenção, e por isso vem depois e não no lugar delas.
 */
#[UseCheapestModel]
#[Timeout(Limits::TIMEOUT)]
class AuthValidator implements Agent, HasStructuredOutput
{
    use Promptable;

    /**
     * @param  list<array<string, mixed>>  $events
     * @return list<Violation>
     */
    public static function check(Playwright $playwright, array $events, ?string $gherkin = null): array
    {
        $response = static::make()->prompt(ValidatorPrompt::of($playwright->value, $events, $gherkin));

        return array_map(
            fn (string $issue): Violation => new Violation('fidelidade', $issue),
            StructuredOutput::fieldArray($response, 'issues'),
        );
    }

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você revisa um arquivo de setup de autenticação Playwright contra a gravação que o originou.

        O prompt é um JSON com spec (o arquivo), events (a gravação do login) e, quando houver, gherkin (a intenção declarada).

        Aponte apenas o que a leitura do código revela e um regex não pegaria:
        - passo da gravação que o arquivo não reproduz, ou passo no arquivo que não existe na gravação;
        - ação que não faz o que o título do step promete;
        - erro semântico de TypeScript ou de API do Playwright que impediria o arquivo de rodar;
        - comentário deixado no código.

        Não repita regra de formatação, de URL ou de variável de ambiente: essas já foram conferidas antes de você.

        Cada issue é uma frase em português dizendo o problema e onde ele está. Sem problema, devolva issues vazio: apontar o que não existe custa uma correção à toa.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'fiel' => $schema->boolean()->description('O arquivo reproduz o login gravado'),
            'issues' => $schema->array()->items($schema->string())
                ->description('Um problema por frase, em português. Vazio quando não há nenhum.'),
        ];
    }
}
