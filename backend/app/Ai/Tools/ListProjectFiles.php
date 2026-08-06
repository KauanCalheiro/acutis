<?php

namespace App\Ai\Tools;

use App\Ai\Tools\Concerns\WithinProject;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use SplFileInfo;
use Symfony\Component\Finder\Finder;
use Throwable;

/** O mapa do projeto testado, para o agente saber o que pedir ao ReadProjectFile. */
final class ListProjectFiles implements Tool
{
    use WithinProject;

    /** ponytail: teto de listagem; projeto maior que isso pede o subdiretório em vez da raiz */
    private const LIMIT = 200;

    private const IGNORED = 'node_modules';

    public function __construct(private readonly string $project) {}

    public function description(): string
    {
        return 'Lista os arquivos do projeto de testes, em caminhos relativos à raiz dele. '
            .'Passe um diretório para restringir a listagem.';
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'directory' => $schema->string()
                ->description('Diretório a listar, relativo à raiz do projeto. Vazio lista a raiz.'),
        ];
    }

    public function handle(Request $request): string
    {
        $directory = (string) ($request['directory'] ?? '');
        $target = $this->resolved($this->project, $directory === '' ? '.' : $directory);

        if ($target === false) {
            return "Diretório não encontrado: {$directory}";
        }

        if (! $this->contains($this->project, $target) || ! is_dir($target)) {
            return "Caminho fora do projeto: {$directory}";
        }

        $root = (string) realpath($this->project);

        try {
            $found = iterator_to_array(
                Finder::create()->files()->ignoreDotFiles(true)->ignoreUnreadableDirs()->in($target),
                false,
            );
        } catch (Throwable) {
            return "Não foi possível listar {$directory}.";
        }

        $files = collect($found)
            ->reject(fn (SplFileInfo $file): bool => $this->holdsSecret($this->project, $file->getPathname()))
            ->map(fn (SplFileInfo $file): string => ltrim(str_replace($root, '', $file->getPathname()), '/'))
            ->reject(fn (string $path): bool => str_contains($path, self::IGNORED))
            ->take(self::LIMIT)
            ->values();

        return $files->isEmpty() ? 'Nenhum arquivo neste diretório.' : $files->implode("\n");
    }
}
