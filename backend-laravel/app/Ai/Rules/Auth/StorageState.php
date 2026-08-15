<?php

namespace App\Ai\Rules\Auth;

use App\Ai\Rules\Violation;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;

/** Setup que não salva a sessão faz todo cenário autenticado rodar deslogado. */
final class StorageState
{
    /** @return list<Violation> */
    public static function check(Playwright $playwright, Url $base, Environments $environments): array
    {
        if ($playwright->has('storageState(')) {
            return [];
        }

        return [new Violation(
            'storage-state-ausente',
            'O setup termina sem salvar a sessão; feche com page.context().storageState({ path: ... }).',
        )];
    }
}
