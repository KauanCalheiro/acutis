<?php

namespace App\Ai\Tools\Concerns;

/**
 * A cerca das tools que tocam disco. O caminho vem do modelo, então é entrada não confiável: só
 * o que resolve para dentro da raiz do projeto passa, e resolver é com realpath, que desfaz ..
 * e symlink antes da comparação.
 */
trait WithinProject
{
    /** O caminho real, ou false quando não existe. */
    private function resolved(string $root, string $path): string|false
    {
        $base = realpath($root);

        if ($base === false) {
            return false;
        }

        return realpath(str_starts_with($path, DIRECTORY_SEPARATOR) ? $path : $base.DIRECTORY_SEPARATOR.$path);
    }

    private function contains(string $root, string $target): bool
    {
        $base = realpath($root);

        return $base !== false && ($target === $base || str_starts_with($target, $base.DIRECTORY_SEPARATOR));
    }
}
