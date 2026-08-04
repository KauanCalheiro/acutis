<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Attributes\DataCollectionOf;
use Spatie\LaravelData\Data;

class EnvironmentData extends Data
{
    /** @param  list<EnvironmentVarData>  $vars */
    public function __construct(
        public readonly string $name,
        #[DataCollectionOf(EnvironmentVarData::class)]
        public readonly array $vars = [],
    ) {}

    public static function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:60'],
            'vars' => ['array'],
            'vars.*.key' => ['required', 'string', 'regex:/^'.EnvironmentVarData::KEY.'$/', 'distinct'],
            'vars.*.value' => ['nullable', 'string'],
            'vars.*.secret' => ['boolean'],
        ];
    }

    public static function messages(): array
    {
        return [
            'name.required' => 'O nome do ambiente é obrigatório.',
            'vars.*.key.required' => 'A variável precisa de um nome.',
            'vars.*.key.regex' => 'O nome da variável só aceita letras, números e underscore, e não pode começar com número.',
            'vars.*.key.distinct' => 'Essa variável já existe neste ambiente.',
        ];
    }
}
