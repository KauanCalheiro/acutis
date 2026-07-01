<?php

namespace App\Support;

use Symfony\Component\Process\Process;

class Git
{
    /** URL do remote `origin`, ou null se não for um repositório git / sem remote. */
    public static function remoteUrl(string $path): ?string
    {
        $process = new Process(['git', '-C', $path, 'remote', 'get-url', 'origin']);
        $process->run();

        return $process->isSuccessful() ? (trim($process->getOutput()) ?: null) : null;
    }
}
