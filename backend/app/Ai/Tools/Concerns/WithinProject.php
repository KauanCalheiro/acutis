<?php

namespace App\Ai\Tools\Concerns;

/**
 * A cerca das tools que tocam disco. O caminho vem do modelo, então é entrada não confiável: só
 * o que resolve para dentro da raiz do projeto passa, e resolver é com realpath, que desfaz ..
 * e symlink antes da comparação.
 */
trait WithinProject
{
    /**
     * O que guarda segredo em texto e por isso não é lido nem listado.
     *
     * A cerca por realpath impede sair do projeto, mas o cofre está dentro dele: as credenciais
     * vivem em environments/*.json e no .env, e a sessão salva é credencial em outra forma. Numa
     * execução real o agente leu o ambiente e colou a senha literal no spec como valor padrão.
     *
     * @var list<string>
     */
    private const HOLDS_SECRET = ['.env', 'environments', 'storage-state'];

    private function holdsSecret(string $root, string $target): bool
    {
        $base = realpath($root);
        $relative = $base === false ? $target : ltrim(str_replace($base, '', $target), DIRECTORY_SEPARATOR);

        foreach (self::HOLDS_SECRET as $secret) {
            if (str_starts_with($relative, $secret)) {
                return true;
            }
        }

        return false;
    }

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
