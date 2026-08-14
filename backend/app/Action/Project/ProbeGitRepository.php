<?php

namespace App\Action\Project;

use Lorisleiva\Actions\Concerns\AsAction;
use Symfony\Component\Process\Process;

class ProbeGitRepository
{
    use AsAction;

    public function handle(string $url): bool
    {
        $process = new Process([acutis()->gitBin, 'ls-remote', $url], null, [
            'GIT_TERMINAL_PROMPT' => '0',
            'GIT_SSH_COMMAND' => 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new',
        ], null, 15);

        $process->run();

        return $process->isSuccessful();
    }
}
