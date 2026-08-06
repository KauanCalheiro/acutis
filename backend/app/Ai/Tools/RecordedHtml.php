<?php

namespace App\Ai\Tools;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;

/**
 * O DOM ao redor do elemento no instante em que o usuário agiu. Fica fora do prompt porque é
 * grande e quase nunca necessário: o seletor do evento costuma bastar. Vale quando não basta,
 * que é o caso do seletor duplicado — dois elementos iguais na mesma tela, e só o que está em
 * volta diz qual deles o usuário clicou.
 *
 * Recebe o mapa pronto porque a origem muda: na geração ele vem da gravação em memória, na
 * correção vem do arquivo que ficou ao lado do spec.
 */
final class RecordedHtml implements Tool
{
    /** @param  array<int, string>  $html  índice do evento → DOM ao redor do elemento */
    public function __construct(private readonly array $html) {}

    public function description(): string
    {
        return 'Devolve o HTML ao redor do elemento de um evento gravado, pelo índice dele. '
            .'Use quando o seletor do evento não for suficiente, como em elementos duplicados na mesma tela.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'index' => $schema->integer()
                ->description('Índice do evento na lista de events do prompt.')
                ->required(),
        ];
    }

    public function handle(Request $request): string
    {
        $index = (int) $request['index'];

        return $this->html[$index] ?? "Nenhum HTML capturado para o evento {$index}.";
    }
}
