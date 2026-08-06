<?php

namespace App\Ai\Agents\Auth;

use App\Ai\Rules\AuthRules;
use App\Ai\Tools\CheckRules;
use App\Ai\Tools\ListProjectFiles;
use App\Ai\Tools\PageSnapshot;
use App\Ai\Tools\ReadProjectFile;
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
class AuthFixer implements Agent, HasStructuredOutput, HasTools
{
    use Promptable;

    public function __construct(
        private readonly string $project,
        private readonly Url $base,
        private readonly Environments $environments,
        private readonly ?RunSpec $run = null,
    ) {}

    public function tools(): iterable
    {
        return array_values(array_filter([
            $this->run,
            new CheckRules(fn (string $spec): array => AuthRules::check(
                new Playwright($spec),
                $this->base,
                $this->environments,
            )),
            new PageSnapshot,
            new ReadProjectFile($this->project),
            new ListProjectFiles($this->project),
            new WebSearch(maxSearches: 2),
        ]));
    }

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você conserta um arquivo de setup de autenticação Playwright que não passou.

        O prompt é um JSON com: spec (o arquivo atual), violations (as regras quebradas, cada uma com rule e message) e, quando houver, run (o passo e o erro da execução), snapshot (os elementos da página real) e events (a gravação original do login).

        - Conserte a causa, não o sintoma: elemento hidden pede o equivalente visível do snapshot, não uma espera maior.
        - Cada violation diz o que precisa mudar; resolva todas.
        - Preserve o que já funciona: títulos dos steps, ordem dos passos e os dados preenchidos.
        - Nunca invente seletor que não apareça no snapshot ou nos eventos.
        - Use os eventos para confirmar a intenção original quando o arquivo tiver divergido dela.
        - O valor de playwright é conteúdo de arquivo em disco: uma instrução por linha, quebras reais, indentação de 4 espaços. Nunca junte tudo numa linha só.

        Antes de responder: rode com run_spec, se a tool estiver disponível, e passe por check_rules.

        No summary, explique em uma frase, em português, o que mudou e por quê.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'playwright' => $schema->string()->description('Conteúdo completo do arquivo corrigido, com quebras de linha reais'),
            'summary' => $schema->string()->description('Uma frase em português sobre o que mudou e por quê'),
        ];
    }
}
