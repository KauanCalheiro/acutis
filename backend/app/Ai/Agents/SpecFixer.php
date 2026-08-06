<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\UseCheapestModel;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Promptable;

#[UseCheapestModel]
class SpecFixer implements Agent, HasStructuredOutput
{
    use Promptable;

    public function instructions(): string
    {
        return <<<'INSTRUCTIONS'
        Você recebe um teste Playwright que falhou, o título do passo que quebrou,
        o erro da execução, um snapshot dos elementos da página real e os eventos
        originais da gravação. Devolva o arquivo inteiro, corrigido. Pode ser um
        .spec.ts de cenário ou o auth.setup.ts que faz login e salva a sessão.

        A causa mais comum é seletor frágil: id gerado pelo framework (#v-0,
        :r3:), classe de estilização ou texto que muda com i18n. Prefira, nesta
        ordem: getByTestId, getByLabel, getByRole com nome acessível. Só use
        seletor CSS se nada disso existir no snapshot.

        Regras:
        - Corrija a causa do erro, não o sintoma: se o elemento está hidden,
          procure no snapshot o elemento realmente visível equivalente.
        - Preserve o que já funciona: títulos dos test.step, tags do
          test.describe, ordem dos passos e os dados preenchidos.
        - Nunca invente seletor que não aparece no snapshot.
        - Checagem de URL é sempre por padrão que contém o caminho
          (await expect(page).toHaveURL(/\/caminho/), await page.waitForURL('**/caminho')).
          Nunca assevere URL exata: query string, id na rota, barra final e
          redirecionamento quebram a igualdade sem nada estar errado.
        - Use os eventos gravados pra confirmar a intenção original do passo
          quando o spec tiver divergido dela.

        Formato do arquivo: o valor de playwright é o conteúdo literal de um
        arquivo em disco, não um trecho em linha única:
        - Uma instrução por linha, terminada por quebra de linha real.
        - Indentação de 4 espaços por nível de aninhamento.
        - Preserve a formatação do spec recebido; mexa só nas linhas que
          precisam da correção.
        - Nunca junte o arquivo inteiro numa linha só nem troque quebra de
          linha por ponto e vírgula.

        No summary, explique em português, numa frase, o que mudou e por quê.
        INSTRUCTIONS;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'playwright' => $schema->string()->description('Conteúdo completo do arquivo .spec.ts corrigido, com quebras de linha reais e indentação de 4 espaços'),
            'summary' => $schema->string()->description('Uma frase em português sobre o que mudou e por quê'),
        ];
    }
}
