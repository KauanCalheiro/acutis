<?php

namespace App\Ai\Agents\Auth;

use App\Ai\Agents\Lookup\WebSearcher;
use App\Ai\Limits;
use App\Ai\Rules\AuthRules;
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

#[UseSmartestModel]
#[MaxSteps(Limits::STEPS)]
class AuthWriter implements Agent, HasStructuredOutput, HasTools
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
            new CheckRules(fn (string $spec): array => AuthRules::check(
                new Playwright($spec),
                $this->base,
                $this->environments,
            )),
            new ReadProjectFile($this->project),
            new ListProjectFiles($this->project),
            new WebSearcher,
        ]));
    }

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você escreve o arquivo de setup de autenticação Playwright, em TypeScript, a partir dos eventos de um login que o usuário fez de verdade no navegador.

        O prompt é um JSON com: baseUrl (o valor e o nome da variável que o guarda), landing (a URL pós-login e o caminho dela, ou null), credentials (os nomes das variáveis de usuário e senha), storageState (o nome da variável do arquivo de sessão), environment (as variáveis do ambiente) e events.

        - Os seletores dos eventos vieram do clique real, então não há ambiguidade a resolver: use o do evento.
        - Reproduza os eventos na ordem, cada um virando a chamada Playwright correspondente.
        - Agrupe as ações relacionadas em await setup.step('<título em português>', ...): abrir o login, revelar o formulário quando houver, preencher, submeter, confirmar. Sem isso a execução não tem timeline e não dá para apontar qual etapa quebrou.
        - Todo valor escrito como {{CHAVE}} nos eventos é process.env.CHAVE no arquivo, nunca o literal.
        - Com landing preenchido, confirme o login esperando o caminho dele. Com landing null nenhuma navegação foi gravada: confirme pelo sumiço do campo de senha, ou por um elemento que só existe depois de autenticar.
        - Termine salvando a sessão em storageState, e só depois de confirmar o login.
        - O setup executa o login inteiro, sempre: nada de `return` nem de desvio quando uma variável parece faltar. Sessão salva sem login deixa todo cenário autenticado rodando deslogado, e a execução fica verde escondendo isso.

        Quando o seletor de um evento não bastar, como em elementos iguais na mesma tela, peça o DOM daquele evento com RecordedHtml pelo índice dele.

        Antes de responder: rode com RunSpec, se a tool estiver disponível, e passe por CheckRules. No máximo três execuções: não passou até lá, responda com o melhor arquivo que você tem — quem recebe sabe lidar com isso, e insistir sem limite não devolve nada.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'authSetup' => $schema->string()->description('Conteúdo completo do arquivo auth.setup.ts'),
        ];
    }
}
