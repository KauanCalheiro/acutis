<?php

namespace App\Ai\Agents\Scenario;

use App\Ai\Rules\SpecRules;
use App\Ai\Tools\CheckRules;
use App\Ai\Tools\ListProjectFiles;
use App\Ai\Tools\ReadProjectFile;
use App\Ai\Tools\RecordedHtml;
use App\Ai\Tools\RunSpec;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxSteps;
use Laravel\Ai\Attributes\UseSmartestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Promptable;
use Laravel\Ai\Providers\Tools\WebSearch;

#[UseSmartestModel]
#[MaxSteps(8)]
class ScenarioWriter implements Agent, HasStructuredOutput, HasTools
{
    use Promptable;

    public function __construct(
        private readonly string $project,
        private readonly Url $base,
        private readonly Environments $environments,
        private readonly ?RunSpec $run = null,
        /** @var array<int, string> índice do evento → DOM ao redor do elemento */
        private readonly array $html = [],
    ) {}

    /** Sem URL de execução não há onde rodar, e aí a tool de execução nem é oferecida. */
    public function tools(): iterable
    {
        return array_values(array_filter([
            $this->run,
            $this->html === [] ? null : new RecordedHtml($this->html),
            new CheckRules(fn (string $spec): array => SpecRules::check(
                new Playwright($spec),
                $this->base,
                $this->environments,
            )),
            new ReadProjectFile($this->project),
            new ListProjectFiles($this->project),
            new WebSearch(maxSearches: 2),
        ]));
    }

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você escreve testes Playwright em TypeScript a partir de um cenário Gherkin e dos eventos de gravação que o originaram.

        O prompt é um JSON com: baseUrl (o valor e o nome da variável que o guarda), gherkin (o cenário a implementar), environment (as variáveis do ambiente), events (a gravação) e pauses (onde o usuário esperou a página).

        - Implemente exatamente o cenário do Gherkin; os eventos são a fonte de seletores e valores.
        - Prioridade de seletor: getByTestId, depois id, depois finder por texto.
        - Estruture com test.describe e await test.step espelhando os passos do Gherkin.
        - Todo valor escrito como {{CHAVE}} nos eventos é process.env.CHAVE no arquivo, nunca o literal.
        - Para cada marcador {{SENSIVEL_n}} que aparecer, escolha um nome de variável em MAIÚSCULAS que descreva o valor e reporte o par em envVars. Só esses marcadores entram lá.
        - Em pauses, a página carregava ou hidratava naquele ponto: antes da ação correspondente, espere o elemento alvo com await expect(locator).toBeVisible().
        - No resto, confie no auto-wait do Playwright e não adicione espera redundante.

        Quando o seletor de um evento não bastar, como em elementos iguais na mesma tela, peça o DOM daquele evento com RecordedHtml pelo índice dele.

        Antes de responder: rode com RunSpec, se a tool estiver disponível, e passe por CheckRules. Só responda com o arquivo que sobreviveu às duas.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'playwright' => $schema->string()->description('Conteúdo completo do arquivo .spec.ts'),
            'envVars' => $schema->array()->items($schema->object([
                'marker' => $schema->string()->description('O marcador que apareceu nos eventos, ex.: SENSIVEL_1'),
                'name' => $schema->string()->description('Nome da variável de ambiente para esse valor, em MAIÚSCULAS'),
            ]))->description('Um item por marcador {{SENSIVEL_n}} dos eventos. Vazio quando não houver nenhum.'),
        ];
    }
}
