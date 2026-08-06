<?php

namespace App\Data\V1\Auth;

use Spatie\LaravelData\Data;

class GeneratedAuthSetupData extends Data
{
    /** @param  list<string>  $warnings  o que só o usuário resolve, como variável declarada sem valor */
    public function __construct(
        public string $authSetup,
        public bool $credentialsNeeded,
        public array $warnings = [],
    ) {}
}
