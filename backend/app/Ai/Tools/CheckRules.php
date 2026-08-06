<?php

namespace App\Ai\Tools;

use App\Ai\Rules\Violation;
use Closure;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;

/**
 * A autoconferência do agente antes de responder. É o que faz o loop de correção da Action ser
 * rede de segurança em vez de caminho normal: o modelo descobre a violação enquanto ainda está
 * escrevendo, e não uma chamada depois.
 */
final class CheckRules implements Tool
{
    /** @param  Closure(string): list<Violation>  $check */
    public function __construct(private readonly Closure $check) {}

    public function description(): string
    {
        return 'Confere o arquivo contra as regras do projeto e devolve o que está quebrado. '
            .'Chame antes de responder: violação que sobrar volta para você corrigir de qualquer forma.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'spec' => $schema->string()->description('Conteúdo completo do arquivo a conferir.')->required(),
        ];
    }

    public function handle(Request $request): string
    {
        $violations = ($this->check)((string) $request['spec']);

        if ($violations === []) {
            return 'Nenhuma regra quebrada.';
        }

        return collect($violations)
            ->map(fn (Violation $violation): string => "- {$violation->rule}: {$violation->message}")
            ->prepend('Regras quebradas:')
            ->implode("\n");
    }
}
