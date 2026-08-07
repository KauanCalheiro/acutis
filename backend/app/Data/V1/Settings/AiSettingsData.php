<?php

namespace App\Data\V1\Settings;

use App\Enums\SettingKey;
use App\Models\Setting;
use Illuminate\Validation\Rule;
use Spatie\LaravelData\Data;

class AiSettingsData extends Data
{
    public function __construct(
        public string $provider,
        public ?string $key = null,
    ) {}

    public static function rules(): array
    {
        return [
            'provider' => ['required', 'string', Rule::in(array_keys(config('ai.providers')))],
            'key' => [
                Rule::requiredIf(fn (): bool => Setting::get(SettingKey::AI_PROVIDER) !== request('provider')),
                'nullable',
                'string',
            ],
        ];
    }

    public static function messages(): array
    {
        return [
            'provider.required' => 'O provedor é obrigatório.',
            'provider.in' => 'Provedor não suportado.',
            'key.required' => 'A chave de API do provedor escolhido é obrigatória.',
        ];
    }
}
