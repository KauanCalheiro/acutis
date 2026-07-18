<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[Model('gemini-2.5-flash-lite')]
class PlaywrightWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você escreve testes Playwright em TypeScript a partir de um cenário Gherkin e dos eventos de gravação de navegador que o originaram.

        Regras:
        - Implemente exatamente o cenário descrito no Gherkin; os eventos são a fonte de seletores e valores.
        - Prioridade de seletor: dataTestId (page.getByTestId) > id (page.locator('#...')) > finder.
        - Estruture com test.describe e test.step espelhando os passos do Gherkin.
        - O test.describe SEMPRE declara as mesmas tags do Gherkin via option tag: test.describe('Título', { tag: ['@read'] }, () => { ... }) — a primeira é exatamente uma entre @read e @write.
        - Navegue sempre com URL absoluta construída a partir da URL base fornecida — nunca page.goto('/') relativo.
        - Inclua expect de URL após cada navegação registrada nos eventos.
        - Valores de senha chegam mascarados como •••• — use process.env.<NOME_EM_MAIUSCULAS> (nunca o valor mascarado) e reporte esse nome exato em envVars, na mesma ordem em que os eventos mascarados aparecem na gravação.
        - Importe apenas de @playwright/test.

        Esperas:
        - Nunca use waitForTimeout nem esperas de tempo fixo; sempre espere uma condição.
        - Após cada evento navigate, aguarde a nova página com await page.waitForURL(...) antes da próxima interação.
        - Se o prompt listar "Pausas notáveis", o usuário esperou a página carregar ou hidratar naquele ponto: antes da ação correspondente, aguarde o elemento alvo com await expect(locator).toBeVisible().
        - No restante, confie no auto-wait do Playwright — não adicione esperas redundantes.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'playwright' => $schema->string()->description('Conteúdo completo do arquivo .spec.ts'),
            'envVars' => $schema->array()->items($schema->string())
                ->description('Nomes exatos das variáveis process.env.<NOME> usadas para valores mascarados como ••••, na ordem em que aparecem. Vazio se não houver nenhum.'),
        ];
    }
}
