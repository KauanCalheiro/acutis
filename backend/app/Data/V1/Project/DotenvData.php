<?php

namespace App\Data\V1\Project;

use Spatie\LaravelData\Attributes\DataCollectionOf;
use Spatie\LaravelData\Data;

class DotenvData extends Data
{
    /** @param  list<EnvironmentVarData>  $vars */
    public function __construct(
        #[DataCollectionOf(EnvironmentVarData::class)]
        public readonly array $vars = [],
    ) {}

    public static function rules(): array
    {
        return [
            'vars' => ['array'],
            'vars.*.key' => ['required', 'string', 'regex:/^'.EnvironmentVarData::KEY.'$/', 'distinct'],
            'vars.*.value' => ['nullable', 'string'],
        ];
    }

    public static function messages(): array
    {
        return [
            'vars.*.key.required' => 'A variável precisa de um nome.',
            'vars.*.key.regex' => 'O nome da variável só aceita letras, números e underscore, e não pode começar com número.',
            'vars.*.key.distinct' => 'Essa variável aparece duas vezes.',
        ];
    }
}
