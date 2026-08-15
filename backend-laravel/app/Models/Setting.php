<?php

namespace App\Models;

use App\Enums\SettingKey;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Uma configuração global, guardada por chave. O valor é cifrado em disco: a chave de API mora
 * aqui, e cifrar todas as linhas sai mais barato do que decidir linha a linha quais são segredo.
 */
#[Fillable(['key', 'value'])]
class Setting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected function casts(): array
    {
        return ['value' => 'encrypted'];
    }

    /** O valor guardado, ou null quando a chave nunca foi configurada. */
    public static function get(SettingKey $key): ?string
    {
        return static::find($key->value)?->value;
    }

    public static function set(SettingKey $key, string $value): void
    {
        static::updateOrCreate(['key' => $key->value], ['value' => $value]);
    }
}
