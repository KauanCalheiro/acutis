<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * O cadastro de um provedor de IA. Cada provedor guarda o seu, então trocar de provedor e voltar
 * não custa redigitar chave nenhuma.
 *
 * Só a chave é cifrada em disco: endereço e nome de modelo não são segredo, e deixá-los legíveis
 * permite conferir a configuração direto no banco.
 */
#[Fillable(['provider', 'key', 'url', 'model_cheapest', 'model_smartest'])]
class AiSetting extends Model
{
    protected $primaryKey = 'provider';

    protected $keyType = 'string';

    public $incrementing = false;

    protected function casts(): array
    {
        return ['key' => 'encrypted'];
    }
}
