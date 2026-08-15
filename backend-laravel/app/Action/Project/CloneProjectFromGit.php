<?php

namespace App\Action\Project;

use App\Data\V1\Project\CloneProjectData;
use App\Data\V1\Project\ProjectData;
use App\Enums\GitProvider;
use App\Support\Git;
use App\Support\Project;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Lorisleiva\Actions\Concerns\AsAction;
use RuntimeException;
use Symfony\Component\Process\Process;

class CloneProjectFromGit
{
    use AsAction;

    public function handle(CloneProjectData $data): ProjectData
    {
        $name = $data->name ?: preg_replace('/\.git$/', '', basename($data->url));
        $slug = Str::slug($name);
        $path = acutis()->projectsPath."/{$slug}";

        [$cloneUrl, $cleanUrl, $env, $cleanup] = $this->resolveAuth($data);

        try {
            $args = ['git', 'clone'];
            if ($data->branch) {
                $args[] = '--branch';
                $args[] = $data->branch;
            }
            $args[] = $cloneUrl;
            $args[] = $path;

            $clone = new Process($args, null, $env, null, 300);
            $clone->run();

            if (! $clone->isSuccessful()) {
                throw new RuntimeException('Falha ao clonar o repositório: '.trim($clone->getErrorOutput() ?: $clone->getOutput()));
            }

            if ($cleanUrl !== null) {
                (new Process(['git', '-C', $path, 'remote', 'set-url', 'origin', $cleanUrl]))->run();
            }
        } finally {
            $cleanup();
        }

        $createdAt = WriteAcutisManifest::run($path, $name, $slug);

        Project::at($path)->environments()->ensure();
        $repository = Git::in($path)->remoteUrl();

        return new ProjectData(
            name: $name,
            slug: $slug,
            path: $path,
            repository: $repository,
            provider: GitProvider::fromUrl($repository),
            created_at: $createdAt,
        );
    }

    public static function tokenUrl(string $url, string $token): string
    {
        return preg_replace('#^https://#', 'https://'.rawurlencode($token).'@', $url, 1);
    }

    /**
     * @return array{0: string, 1: ?string, 2: ?array<string, string>, 3: callable}
     */
    private function resolveAuth(CloneProjectData $data): array
    {
        return match ($data->auth) {
            'token' => [self::tokenUrl($data->url, $data->token), $data->url, null, fn () => null],
            'ssh_key' => $this->sshAuth($data),
            default => [$data->url, null, null, fn () => null],
        };
    }

    /**
     * ponytail: arquivo de chave temporário; o caminho não tem espaço, então não precisa de aspas
     * no GIT_SSH_COMMAND.
     *
     * @return array{0: string, 1: ?string, 2: array<string, string>, 3: callable}
     */
    private function sshAuth(CloneProjectData $data): array
    {
        $keyFile = tempnam(sys_get_temp_dir(), 'acutis-ssh-');
        File::put($keyFile, rtrim((string) $data->ssh_key)."\n");
        chmod($keyFile, 0600);

        $env = [
            'GIT_SSH_COMMAND' => "ssh -i {$keyFile} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new",
        ];

        return [$data->url, null, $env, fn () => @unlink($keyFile)];
    }
}
