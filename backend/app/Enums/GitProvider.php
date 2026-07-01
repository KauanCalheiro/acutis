<?php

namespace App\Enums;

enum GitProvider: string
{
    case Github = 'github';
    case Gitlab = 'gitlab';

    /** Detecta o provedor a partir da URL do remote; null = local-only / desconhecido. */
    public static function fromUrl(?string $url): ?self
    {
        if (! $url) {
            return null;
        }

        return match (true) {
            str_contains($url, 'github.com') => self::Github,
            str_contains($url, 'gitlab.com') => self::Gitlab,
            default => null,
        };
    }
}
