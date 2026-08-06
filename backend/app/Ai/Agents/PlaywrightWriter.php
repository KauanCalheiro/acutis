<?php

namespace App\Ai\Agents;

use App\Enums\EnvKey;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\UseSmartestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[UseSmartestModel]
class PlaywrightWriter implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        $url = EnvKey::URL->value;

        return <<<INSTRUCTIONS
        Você escreve testes Playwright em TypeScript a partir de um cenário Gherkin e dos eventos de gravação de navegador que o originaram.

        Regras:
        - Implemente exatamente o cenário descrito no Gherkin; os eventos são a fonte de seletores e valores.
        - Prioridade de seletor: dataTestId (page.getByTestId) > id (page.locator('#...')) > finder.
        - Estruture com test.describe e await test.step espelhando os passos do Gherkin, o test.step sempre deve fazer com `await test.step` para não rodar em paralelo e falhar.
        - O test.describe SEMPRE declara as mesmas tags do Gherkin via option tag: test.describe('Título', { tag: ['@read'] }, () => { ... }), e a primeira é exatamente uma entre @read e @write.
        - A URL base do sistema é a variável de ambiente {$url}: navegue sempre com URL absoluta construída a partir de process.env.{$url}, nunca com a URL literal e nunca com page.goto('/') relativo.
        - {$url} é o único nome que existe para essa variável: nunca escreva process.env.BASE_URL, process.env.APP_URL nem qualquer outro nome inventado a partir do rótulo "URL base".
        - O caminho a concatenar é só o que sobra da URL do evento depois da URL base: nunca repita segmento que a base já traz. Base https://sistema.test/intranet e evento em https://sistema.test/intranet/produtos viram `\${process.env.{$url}}/produtos`, nunca `\${process.env.{$url}}/intranet/produtos`.
        - Inclua expect de URL após cada navegação registrada nos eventos, sempre por padrão que contém o caminho: await expect(page).toHaveURL(/\/caminho/).
        - NUNCA assevere URL exata — nem a string inteira, nem template com a base. Query string, id na rota, barra final e redirecionamento fazem a igualdade exata falhar sem nada estar quebrado.
        - Valores de senha chegam mascarados como ••••, então use process.env.<NOME_EM_MAIUSCULAS> (nunca o valor mascarado) e reporte esse nome exato em envVars, na mesma ordem em que os eventos mascarados aparecem na gravação.
        - Se o prompt listar "Variáveis do ambiente" e algum valor da gravação for igual ao valor de uma delas, escreva process.env.CHAVE no lugar do literal e reporte a chave em envVars.
        - Variável listada como escondida não traz valor: use process.env.CHAVE direto e reporte a chave em envVars.
        - Importe apenas de @playwright/test.

        Esperas:
        - Nunca use waitForTimeout nem esperas de tempo fixo; sempre espere uma condição.
        - Após cada evento navigate, aguarde a nova página com await page.waitForURL('**/caminho') antes da próxima interação.
        - Se o prompt listar "Pausas notáveis", o usuário esperou a página carregar ou hidratar naquele ponto: antes da ação correspondente, aguarde o elemento alvo com await expect(locator).toBeVisible().
        - No restante, confie no auto-wait do Playwright e não adicione esperas redundantes.
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
