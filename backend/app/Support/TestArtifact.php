<?php

namespace App\Support;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * Lê e re-carimba título/tags nos artefatos gerados (.feature Gherkin e .spec Playwright).
 * Fonte de verdade dos campos editáveis do rascunho: quem lista os cenários (ListProjectScenarios)
 * tira o título da linha `Funcionalidade:` e as tags do `tag: [...]` do spec.
 */
final class TestArtifact
{
    /**
     * Teto do título e do caminho. O título vira nome de arquivo pelo slug, e o caminho ainda
     * ganha `tests/`, `.spec.ts` e o diretório do projeto: o sistema de arquivos recusa o
     * componente acima de 255 bytes, e um acento ocupa dois.
     */
    public const TITLE_LIMIT = 120;

    public const PATH_LIMIT = 80;

    /**
     * A palavra que abre a próxima cláusula. Feature devolvida numa linha só é comum, e sem cortar
     * ali o título vira o documento inteiro.
     */
    private const NEXT_CLAUSE = '/\s+(?:Como|Eu quero|Para|Contexto:|Cen[áa]rio|Esquema do Cen[áa]rio|Dado|Quando|Ent[ãa]o|E)\b/u';

    public static function title(string $gherkin, string $fallback = 'teste'): string
    {
        if (preg_match('/Funcionalidade:\s*(.+)/u', $gherkin, $m)) {
            return self::firstClause($m[1]);
        }

        return $fallback;
    }

    public static function scenario(string $gherkin, string $fallback = 'executa o fluxo gravado'): string
    {
        if (preg_match('/Cen[áa]rio:\s*(.+)/u', $gherkin, $m)) {
            return self::firstClause($m[1]);
        }

        return $fallback;
    }

    private static function firstClause(string $line): string
    {
        $clause = trim(preg_split(self::NEXT_CLAUSE, trim($line))[0] ?? '');

        return Str::limit($clause, self::TITLE_LIMIT, '');
    }

    /** @return list<string> */
    public static function tags(string $gherkin): array
    {
        $firstLine = trim(strtok($gherkin, "\n") ?: '');

        if (! str_starts_with($firstLine, '@')) {
            return [];
        }

        preg_match_all('/@[\w-]+/', $firstLine, $tags);

        return $tags[0];
    }

    /** Nome de arquivo único (sem extensão) dentro de $dir, evitando sobrescrever. */
    public static function uniquePath(string $dir, string $desired): string
    {
        $candidate = $desired;
        $suffix = 1;

        while (File::exists("{$dir}/{$candidate}.spec.ts")) {
            $suffix++;
            $candidate = "{$desired}-{$suffix}";
        }

        return $candidate;
    }

    /** ponytail: troca só a primeira linha `Funcionalidade:`; se não houver, deixa como está. */
    public static function stampTitle(string $gherkin, string $title): string
    {
        return preg_replace('/Funcionalidade:\s*.+/u', "Funcionalidade: {$title}", $gherkin, 1) ?? $gherkin;
    }

    /**
     * Só a linha que não carrega nada além de tags é substituída. A feature devolvida numa linha
     * só começa com as tags e traz o documento inteiro atrás delas: descartá-la apagaria o cenário.
     */
    public static function stampGherkinTags(string $gherkin, array $tags): string
    {
        $lines = explode("\n", $gherkin);

        if (isset($lines[0]) && preg_match('/^\s*(@[\w-]+\s*)+$/u', $lines[0]) === 1) {
            array_shift($lines);
        } elseif (isset($lines[0]) && str_starts_with(trim($lines[0]), '@')) {
            $lines[0] = trim(preg_replace('/^\s*(@[\w-]+\s*)+/u', '', $lines[0]) ?? $lines[0]);
        }

        $body = implode("\n", $lines);

        return $tags === [] ? $body : implode(' ', $tags)."\n".$body;
    }

    /** ponytail: mesmo casamento de describe usado na geração; sem describe, deixa como está. */
    public static function stampPlaywrightTags(string $playwright, array $tags): string
    {
        if ($tags === []) {
            return $playwright;
        }

        $list = 'tag: ['.implode(', ', array_map(fn (string $t): string => "'{$t}'", $tags)).']';

        if (preg_match('/tag:\s*\[[^\]]*\]/', $playwright)) {
            return preg_replace('/tag:\s*\[[^\]]*\]/', $list, $playwright, 1) ?? $playwright;
        }

        return preg_replace(
            '/test\.describe\(\s*((["\']).+?\2)\s*,\s*(?=\(|async)/',
            "test.describe($1, {{$list}}, ",
            $playwright,
            1,
        ) ?? $playwright;
    }
}
