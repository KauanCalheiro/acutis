<?php

namespace App\Ai\Agents\Scenario;

use App\Ai\Limits;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Timeout;
use Laravel\Ai\Attributes\UseSmartestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[UseSmartestModel]
#[Timeout(Limits::TIMEOUT)]
class ScenarioWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você escreve testes Playwright em TypeScript a partir de um cenário Gherkin e dos eventos de gravação que o originaram.

        O prompt é um JSON com: baseUrl (o valor e o nome da variável que o guarda), gherkin (o cenário a implementar), environment (as variáveis do ambiente), events (a gravação) e pauses (onde o usuário esperou a página).

        - Implemente exatamente o cenário do Gherkin; os eventos são a fonte de seletores e valores.
        - Com publico false, o teste roda com a sessão que o setup de autenticação já deixou salva: não escreva passos de login nem desvio que verifique se está logado. Com publico true ele roda sem sessão, e aí a própria tela de login pode ser o assunto do cenário.
        - Prioridade de seletor: getByTestId, depois id, depois finder por texto.
        - Estruture com test.describe e await test.step espelhando os passos do Gherkin.
        - Todo valor escrito como {{CHAVE}} nos eventos é process.env.CHAVE no arquivo, nunca o literal.
        - Para cada marcador {{SENSIVEL_n}} que aparecer, escolha um nome de variável em MAIÚSCULAS que descreva o valor e reporte o par em envVars. Só esses marcadores entram lá.
        - Em pauses, a página carregava ou hidratava naquele ponto: antes da ação correspondente, espere o elemento alvo com await expect(locator).toBeVisible().
        - No resto, confie no auto-wait do Playwright e não adicione espera redundante.
        - O valor de playwright é conteúdo de arquivo em disco: uma instrução por linha, quebras reais, indentação de 4 espaços. Nunca junte tudo numa linha só.

        Responda de uma vez, com o melhor arquivo que você tem. Quem recebe executa o arquivo e confere as regras; se algo quebrar, você recebe o erro de volta num pedido novo.
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
