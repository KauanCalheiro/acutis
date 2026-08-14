<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

final class Git
{
    private const PUSH_TIMEOUT = 120;

    private function __construct(private readonly string $path) {}

    public static function in(string $path): self
    {
        return new self($path);
    }

    /**
     * Se existe git nesta máquina. Sem ele o acutis continua servindo projeto criado de template —
     * `isRepository()` já torna commit e push inócuos —, mas clonar é impossível, e a interface
     * consulta isto para desabilitar a importação em vez de deixar o clone estourar.
     */
    public static function available(): bool
    {
        $process = new Process([acutis()->gitBin, '--version'], null, null, null, 5);
        $process->run();

        return $process->isSuccessful();
    }

    /** URL do remote `origin`, ou null se o diretório em si não for um repositório git / sem remote. */
    public function remoteUrl(): ?string
    {
        return $this->output(['remote', 'get-url', 'origin']);
    }

    /** Branch atual, ou null se o diretório em si não for um repositório git. */
    public function branch(): ?string
    {
        return $this->output(['rev-parse', '--abbrev-ref', 'HEAD']);
    }

    public function author(): ?string
    {
        return $this->output(['config', 'user.name']);
    }

    /** @param  list<string>  $files */
    public function commit(string $message, array $files): self
    {
        if (! $this->isRepository()) {
            return $this;
        }

        $this->git(['add', '--', ...$files])->run();

        $commit = $this->git(['commit', '-m', $message, '--', ...$files]);
        $commit->run();

        if (! $commit->isSuccessful()) {
            Log::warning("Não foi possível commitar em {$this->path}: ".$commit->getErrorOutput());
        }

        return $this;
    }

    public function push(): self
    {
        if (blank($this->remoteUrl())) {
            return $this;
        }

        $push = $this->git(['push', 'origin', 'HEAD'], self::PUSH_TIMEOUT);
        $push->run();

        if (! $push->isSuccessful()) {
            Log::warning("Não foi possível empurrar {$this->path}: ".$push->getErrorOutput());
        }

        return $this;
    }

    private function isRepository(): bool
    {
        return is_dir($this->path.'/.git');
    }

    /** @param  list<string>  $args */
    private function output(array $args): ?string
    {
        if (! $this->isRepository()) {
            return null;
        }

        $process = $this->git($args);
        $process->run();

        return $process->isSuccessful() ? (trim($process->getOutput()) ?: null) : null;
    }

    /** @param  list<string>  $args */
    private function git(array $args, float $timeout = 60): Process
    {
        return new Process([acutis()->gitBin, '-C', $this->path, ...$args], null, null, null, $timeout);
    }
}
