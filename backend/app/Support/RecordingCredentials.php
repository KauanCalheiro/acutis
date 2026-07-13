<?php

namespace App\Support;

final class RecordingCredentials
{
    public function __construct(
        public readonly ?string $username,
        public readonly ?string $password,
        public readonly ?string $loginUrl,
    ) {}

    public static function extract(array $events): self
    {
        $passwordIndex = null;

        foreach ($events as $index => $event) {
            if (($event['type'] ?? null) === 'fill' && ($event['inputType'] ?? null) === 'password') {
                $passwordIndex = $index;
                break;
            }
        }

        if ($passwordIndex === null) {
            return new self(username: null, password: null, loginUrl: null);
        }

        $username = null;

        for ($i = $passwordIndex - 1; $i >= 0; $i--) {
            if (($events[$i]['type'] ?? null) === 'fill') {
                $username = $events[$i]['value'] ?? null;
                break;
            }
        }

        return new self(
            username: $username,
            password: $events[$passwordIndex]['value'] ?? null,
            loginUrl: $events[$passwordIndex]['url'] ?? null,
        );
    }
}
