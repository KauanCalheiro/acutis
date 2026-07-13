<?php

namespace App\Support;

final class SessionState
{
    public static function hasSession(mixed $state): bool
    {
        if (! is_array($state)) {
            return false;
        }

        if (! empty($state['cookies'])) {
            return true;
        }

        foreach ($state['origins'] ?? [] as $origin) {
            if (! empty($origin['localStorage'])) {
                return true;
            }
        }

        return false;
    }
}
