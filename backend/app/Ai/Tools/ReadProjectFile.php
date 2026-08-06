<?php

namespace App\Ai\Tools;

use App\Ai\Tools\Concerns\WithinProject;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;

/** Deixa o agente ler o projeto testado, para seguir a convenção que já existe lá. */
final class ReadProjectFile implements Tool
{
    use WithinProject;

    public function __construct(private readonly string $project) {}

    public function description(): string
    {
        return 'Lê um arquivo do projeto de testes, pelo caminho relativo à raiz dele. '
            .'Use para conferir o playwright.config.ts, o auth.setup.ts ou um spec já escrito.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'path' => $schema->string()
                ->description('Caminho do arquivo, relativo à raiz do projeto (ex.: tests/auth.setup.ts).')
                ->required(),
        ];
    }

    public function handle(Request $request): string
    {
        $path = (string) $request['path'];
        $target = $this->resolved($this->project, $path);

        if ($target === false) {
            return "Arquivo não encontrado: {$path}";
        }

        if (! $this->contains($this->project, $target) || ! is_file($target)) {
            return "Caminho fora do projeto: {$path}";
        }

        if ($this->holdsSecret($this->project, $target)) {
            return "O arquivo {$path} guarda segredo do projeto e não pode ser lido. "
                .'Os valores dele chegam pelo ambiente do prompt, sempre como nome de variável.';
        }

        return (string) file_get_contents($target);
    }
}
