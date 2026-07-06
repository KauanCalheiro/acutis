<?php

namespace App\Support;

use Illuminate\Support\Facades\File;

/**
 * Lê e re-carimba título/tags nos artefatos gerados (.feature Gherkin e .spec Playwright).
 * Fonte de verdade dos campos editáveis do rascunho: quem lista os cenários (ListProjectScenarios)
 * tira o título da linha `Funcionalidade:` e as tags do `tag: [...]` do spec.
 */
final class TestArtifact
{
    public static function title(string $gherkin, string $fallback = 'teste'): string
    {
        if (preg_match('/Funcionalidade:\s*(.+)/u', $gherkin, $m)) {
            return trim($m[1]);
        }

        return $fallback;
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

    /** Nome de arquivo único (sem extensão) dentro de tests/, evitando sobrescrever. */
    public static function uniquePath(string $projectPath, string $desired): string
    {
        $candidate = $desired;
        $suffix = 1;

        while (File::exists("{$projectPath}/tests/{$candidate}.spec.ts")) {
            $suffix++;
            $candidate = "{$desired}-{$suffix}";
        }

        return $candidate;
    }

    public static function stampTitle(string $gherkin, string $title): string
    {
        // ponytail: troca só a primeira linha `Funcionalidade:`; se não houver, deixa como está
        return preg_replace('/Funcionalidade:\s*.+/u', "Funcionalidade: {$title}", $gherkin, 1) ?? $gherkin;
    }

    public static function stampGherkinTags(string $gherkin, array $tags): string
    {
        $lines = explode("\n", $gherkin);

        if (isset($lines[0]) && str_starts_with(trim($lines[0]), '@')) {
            array_shift($lines);
        }

        $body = implode("\n", $lines);

        return $tags === [] ? $body : implode(' ', $tags)."\n".$body;
    }

    public static function stampPlaywrightTags(string $playwright, array $tags): string
    {
        if ($tags === []) {
            return $playwright;
        }

        $list = 'tag: ['.implode(', ', array_map(fn (string $t): string => "'{$t}'", $tags)).']';

        if (preg_match('/tag:\s*\[[^\]]*\]/', $playwright)) {
            return preg_replace('/tag:\s*\[[^\]]*\]/', $list, $playwright, 1) ?? $playwright;
        }

        // ponytail: mesmo casamento de describe usado na geração; sem describe, deixa como está
        return preg_replace(
            '/test\.describe\(\s*((["\']).+?\2)\s*,\s*(?=\(|async)/',
            "test.describe($1, {{$list}}, ",
            $playwright,
            1,
        ) ?? $playwright;
    }
}
