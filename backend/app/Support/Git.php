<?php

namespace App\Support;

use Symfony\Component\Process\Process;

class Git
{
    /** URL do remote `origin`, ou null se o diretório em si não for um repositório git / sem remote. */
    public static function remoteUrl(string $path): ?string
    {
        if (! is_dir($path.'/.git')) {
            return null;
        }

        $process = new Process(['git', '-C', $path, 'remote', 'get-url', 'origin']);
        $process->run();

        return $process->isSuccessful() ? (trim($process->getOutput()) ?: null) : null;
    }

    /** Branch atual, ou null se o diretório em si não for um repositório git. */
    public static function branch(string $path): ?string
    {
        if (! is_dir($path.'/.git')) {
            return null;
        }

        $process = new Process(['git', '-C', $path, 'rev-parse', '--abbrev-ref', 'HEAD']);
        $process->run();

        return $process->isSuccessful() ? (trim($process->getOutput()) ?: null) : null;
    }
}
