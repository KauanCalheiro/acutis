<?php

namespace App\Support\Recording;

use App\Enums\EnvKey;
use App\Support\Primitives\Environments;
use App\Support\Primitives\Playwright;
use App\Support\Primitives\Url;
use App\Support\Recording;
use Illuminate\Support\Str;

/**
 * Escreve o arquivo Playwright direto dos eventos gravados, sem passar por modelo. Cada evento
 * vira um passo, e o que a gravação não sustenta não é escrito.
 */
final class SpecEmitter
{
    /** Abaixo disso é ritmo de digitação; acima, o usuário esperou a página. */
    private const NOTICEABLE_PAUSE_MS = 2000;

    private const SLOW_TIMEOUT = 15000;

    /** @var array<string, string>|null */
    private ?array $names = null;

    public function __construct(
        private readonly Recording $recording,
        private readonly Url $base,
        private readonly Environments $environments,
    ) {}

    public function spec(string $title, string $scenario): Playwright
    {
        $lines = [
            "import { test, expect } from '@playwright/test'",
            '',
            'const base = process.env.'.EnvKey::URL->value,
            '',
            'test.describe('.$this->literal($title).', () => {',
            '    test('.$this->literal($scenario).', async ({ page }) => {',
            ...$this->render($this->steps($this->recording->redacted($this->environments)), 'test', '        '),
            '    })',
            '})',
        ];

        return new Playwright(implode("\n", $lines)."\n");
    }

    /**
     * O arquivo de login. Termina salvando a sessão no mesmo arquivo que o playwright.config lê,
     * e só depois de confirmar que o login aconteceu.
     */
    public function authSetup(): Playwright
    {
        $events = $this->recording->withoutPasswords();

        $steps = [
            ...$this->steps($events),
            ...array_filter([$this->confirmation($events), $this->session()]),
        ];

        $lines = [
            "import { test as setup, expect } from '@playwright/test'",
            '',
            'const base = process.env.'.EnvKey::URL->value,
            '',
            "setup('autenticação', async ({ page }) => {",
            ...$this->render($steps, 'setup', '    '),
            '})',
        ];

        return new Playwright(implode("\n", $lines)."\n");
    }

    /**
     * @param  list<array{title: string, lines: list<string>}>  $steps
     * @return list<string>
     */
    private function render(array $steps, string $helper, string $pad): array
    {
        $lines = [];

        foreach ($steps as $position => $step) {
            if ($position > 0) {
                $lines[] = '';
            }

            $lines[] = $pad.'await '.$helper.'.step('.$this->literal($step['title']).', async () => {';

            foreach ($step['lines'] as $line) {
                $lines[] = $pad.'    '.$line;
            }

            $lines[] = $pad.'})';
        }

        return $lines;
    }

    /**
     * A prova de que o login aconteceu: a tela em que a gravação caiu, ou o sumiço do campo de
     * senha quando nenhuma navegação foi gravada.
     *
     * @param  list<array<string, mixed>>  $events
     * @return array{title: string, lines: list<string>}|null
     */
    private function confirmation(array $events): ?array
    {
        $segment = $this->segment((string) $this->recording->landingUrl());

        $deadline = '{ timeout: '.self::SLOW_TIMEOUT.' }';

        if ($segment !== null) {
            return [
                'title' => 'Confere que o login levou para '.$this->quoted($segment),
                'lines' => ['await expect(page).toHaveURL(/'.str_replace('.', '\.', $segment)."/, {$deadline})"],
            ];
        }

        foreach ($events as $event) {
            if (($event['inputType'] ?? null) === 'password' && ($locator = $this->locator($event)) !== null) {
                return [
                    'title' => 'Confere que o campo de senha saiu da tela',
                    'lines' => ["await expect({$locator}).toBeHidden({$deadline})"],
                ];
            }
        }

        return null;
    }

    /** @return array{title: string, lines: list<string>} */
    private function session(): array
    {
        $key = EnvKey::STORAGE_STATE->value;

        return [
            'title' => 'Salva a sessão autenticada',
            'lines' => [
                "await page.waitForLoadState('load')",
                "await page.context().storageState({ path: process.env.{$key} || 'storage-state.json' })",
            ],
        ];
    }

    /**
     * Os nomes de variável escolhidos para os valores sensíveis, na ordem do marcador.
     *
     * @return list<string>
     */
    public function envVars(): array
    {
        return array_values($this->names());
    }

    /**
     * @param  list<array<string, mixed>>  $events
     * @return list<array{title: string, lines: list<string>}>
     */
    private function steps(array $events): array
    {
        $steps = [];
        $navigated = false;
        $currentUrl = null;
        $lastField = null;
        $lastClick = null;
        $previousType = null;
        $previousAt = null;

        foreach ($events as $event) {
            $type = (string) ($event['type'] ?? '');
            $at = (int) ($event['timestamp'] ?? 0);
            $slow = $previousAt !== null && $at - $previousAt >= self::NOTICEABLE_PAUSE_MS;
            $previousAt = $at;

            $step = match ($type) {
                'navigate' => $this->navigation($event, $navigated, $currentUrl),
                'click', 'hover' => $this->interaction($event, $type, $slow),
                'fill' => $this->entry($event, $slow, $lastField, $lastClick),
                'submit' => $this->submission($previousType, $lastField),
                'assert' => $this->assertion($event, $slow),
                default => null,
            };

            if ($type === 'navigate' && $this->onBase((string) ($event['url'] ?? ''))) {
                $navigated = true;
                $currentUrl = (string) ($event['url'] ?? '');
            }

            if ($type === 'click') {
                $lastClick = $this->locator($event);
            }

            if ($step !== null) {
                $steps[] = $step;
                $previousType = $type;
            }
        }

        return $steps;
    }

    /**
     * @param  array<string, mixed>  $event
     * @return array{title: string, lines: list<string>}|null
     */
    private function navigation(array $event, bool $navigated, ?string $currentUrl): ?array
    {
        $url = (string) ($event['url'] ?? '');

        if ($navigated && ! $this->onBase($url)) {
            return null;
        }

        if (! $navigated) {
            $path = $this->relativePath($url) ?? '';

            return [
                'title' => 'Navega para '.($path === '' ? 'a página inicial' : $this->quoted($path)),
                'lines' => ['await page.goto(`${base}'.$path.'`)'],
            ];
        }

        $segment = $url === $currentUrl ? null : $this->segment($url);

        if ($segment === null) {
            return null;
        }

        return [
            'title' => 'Aguarda a tela '.$this->quoted($segment),
            'lines' => ["await page.waitForURL('**{$segment}**')"],
        ];
    }

    /**
     * @param  array<string, mixed>  $event
     * @return array{title: string, lines: list<string>}|null
     */
    private function interaction(array $event, string $type, bool $slow): ?array
    {
        $locator = $this->locator($event);

        if ($locator === null) {
            return null;
        }

        $verb = $type === 'hover' ? 'hover' : 'click';
        $prefix = $type === 'hover' ? 'Passa o mouse' : 'Clica';
        $what = $this->describe($event);

        return [
            'title' => $what === null ? "{$prefix} no elemento" : "{$prefix} em ".$this->quoted($what),
            'lines' => [
                "const alvo = {$locator}",
                'await expect(alvo).toBeVisible('.$this->timeout($slow).')',
                "await alvo.{$verb}()",
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $event
     * @return array{title: string, lines: list<string>}|null
     */
    private function entry(array $event, bool $slow, ?string &$lastField, ?string $lastClick): ?array
    {
        $locator = $this->locator($event);

        if ($locator === null) {
            return null;
        }

        $toggle = in_array($event['inputType'] ?? null, ['checkbox', 'radio'], true);

        if ($toggle && $locator === $lastClick) {
            return null;
        }

        $lastField = $locator;
        $value = (string) ($event['value'] ?? '');

        $action = match (true) {
            ($event['tagName'] ?? null) === 'select' => 'selectOption('.$this->value($value).')',
            $toggle => ($event['checked'] ?? true) ? 'check()' : 'uncheck()',
            default => 'fill('.$this->value($value).')',
        };

        $what = $this->describe($event);

        return [
            'title' => 'Preenche '.($what === null ? 'o campo' : $this->quoted($what)),
            'lines' => [
                "const campo = {$locator}",
                'await expect(campo).toBeVisible('.$this->timeout($slow).')',
                "await campo.{$action}",
            ],
        ];
    }

    /**
     * O clique no botão já enviou o formulário; sem clique antes, quem enviou foi o Enter no
     * último campo preenchido.
     *
     * @return array{title: string, lines: list<string>}|null
     */
    private function submission(?string $previousType, ?string $lastField): ?array
    {
        if ($previousType === 'click' || $lastField === null) {
            return null;
        }

        return [
            'title' => 'Envia o formulário',
            'lines' => ["await {$lastField}.press('Enter')"],
        ];
    }

    /**
     * @param  array<string, mixed>  $event
     * @return array{title: string, lines: list<string>}|null
     */
    private function assertion(array $event, bool $slow): ?array
    {
        $assert = $event['assert'] ?? [];
        $expected = $assert['expectedValue'] ?? null;
        $type = (string) ($assert['assertType'] ?? 'visible');

        if ($type === 'url') {
            $segment = $this->segment((string) ($expected ?? $event['url'] ?? ''));

            return $segment === null ? null : [
                'title' => 'Confere que a tela é '.$this->quoted($segment),
                'lines' => ['await expect(page).toHaveURL(/'.str_replace('.', '\.', $segment).'/)'],
            ];
        }

        $locator = $this->locator($event);

        if ($locator === null) {
            return null;
        }

        $matcher = match ($type) {
            'hidden' => 'toBeHidden()',
            'text' => 'toHaveText('.$this->value((string) $expected).')',
            'contains' => 'toContainText('.$this->value((string) $expected).')',
            'value' => 'toHaveValue('.$this->value((string) $expected).')',
            'checked' => 'toBeChecked()',
            'disabled' => 'toBeDisabled()',
            default => 'toBeVisible('.$this->timeout($slow).')',
        };

        $what = $this->describe($event);

        return [
            'title' => 'Confere '.($what === null ? 'o elemento' : $this->quoted($what)),
            'lines' => [
                "const alvo = {$locator}",
                "await expect(alvo).{$matcher}",
            ],
        ];
    }

    /** @param  array<string, mixed>  $event */
    private function locator(array $event): ?string
    {
        $selectors = $event['selectors'] ?? null;

        if (! is_array($selectors)) {
            return null;
        }

        $testId = $selectors['dataTestId'] ?? null;
        $dataCy = $selectors['dataCy'] ?? null;
        $cssStable = $selectors['cssStable'] ?? null;
        $ariaLabel = $selectors['ariaLabel'] ?? null;
        $placeholder = $selectors['placeholder'] ?? null;
        $text = $selectors['text'] ?? null;
        $finder = $selectors['finder'] ?? null;
        $xpath = $selectors['xpath'] ?? null;

        return match (true) {
            filled($testId) => 'page.getByTestId('.$this->literal((string) $testId).')',
            filled($dataCy) => 'page.locator('.$this->literal('[data-cy="'.$dataCy.'"]').')',
            filled($cssStable) => 'page.locator('.$this->literal((string) $cssStable).')',
            filled($ariaLabel) => 'page.locator('.$this->literal('[aria-label="'.$ariaLabel.'"]').')',
            filled($placeholder) => 'page.getByPlaceholder('.$this->literal((string) $placeholder).')',
            filled($text) => 'page.getByText('.$this->literal((string) $text).', { exact: true })',
            filled($finder) => 'page.locator('.$this->literal((string) $finder).')',
            filled($xpath) => 'page.locator('.$this->literal('xpath='.$xpath).')',
            default => null,
        };
    }

    /**
     * Como o passo chama o elemento. Sem nada que o descreva, quem chama diz do seu jeito.
     *
     * @param  array<string, mixed>  $event
     */
    private function describe(array $event): ?string
    {
        $selectors = is_array($event['selectors'] ?? null) ? $event['selectors'] : [];

        $source = (string) ($event['label'] ?? $event['innerText'] ?? $selectors['placeholder'] ?? $selectors['text'] ?? '');
        $source = trim(preg_replace('/\s+/u', ' ', $source) ?? '');

        return $source === '' ? null : Str::limit($source, 60, '');
    }

    private function timeout(bool $slow): string
    {
        return $slow ? '{ timeout: '.self::SLOW_TIMEOUT.' }' : '';
    }

    /** O valor escrito no arquivo: variável quando o ambiente já o guarda, literal quando não. */
    private function value(string $value): string
    {
        if (preg_match('/^\{\{([A-Z0-9_]+)\}\}$/', $value, $marker) === 1) {
            $key = $marker[1];

            return 'process.env.'.($this->names()[$key] ?? $key);
        }

        $key = $this->environments->keyOf($value);

        return $key === null ? $this->literal($value) : "process.env.{$key}";
    }

    /**
     * Marcador de valor sensível → nome de variável, tirado do label do campo que o recebeu.
     *
     * @return array<string, string>
     */
    private function names(): array
    {
        if ($this->names !== null) {
            return $this->names;
        }

        $names = [];

        foreach ($this->recording->redacted($this->environments) as $event) {
            $value = (string) ($event['value'] ?? '');

            if (preg_match('/^\{\{('.Recording::SENSITIVE.'\d+)\}\}$/', $value, $marker) !== 1) {
                continue;
            }

            $names[$marker[1]] = $this->name($event, $marker[1], $names);
        }

        ksort($names, SORT_NATURAL);

        return $this->names = $names;
    }

    /**
     * @param  array<string, mixed>  $event
     * @param  array<string, string>  $taken
     */
    private function name(array $event, string $fallback, array $taken): string
    {
        $selectors = is_array($event['selectors'] ?? null) ? $event['selectors'] : [];

        $source = (string) ($event['label'] ?? $selectors['name'] ?? $selectors['placeholder'] ?? '');
        $candidate = Str::upper(Str::slug($source, '_'));

        if (preg_match('/^[A-Z][A-Z0-9_]*$/', $candidate) !== 1) {
            return $fallback;
        }

        $name = $candidate;
        $suffix = 1;

        while (in_array($name, $taken, true) || $this->environments->has($name)) {
            $suffix++;
            $name = "{$candidate}_{$suffix}";
        }

        return $name;
    }

    /** A navegação é da página gravada, e não de um iframe de terceiro que navega sozinho. */
    private function onBase(string $url): bool
    {
        return parse_url($url, PHP_URL_HOST) === $this->base->host();
    }

    /** O caminho depois da URL base; null quando a navegação saiu para outro host. */
    private function relativePath(string $url): ?string
    {
        if (parse_url($url, PHP_URL_HOST) !== $this->base->host()) {
            return null;
        }

        $path = rtrim((string) parse_url($url, PHP_URL_PATH), '/');
        $basePath = $this->base->path();

        if ($basePath !== '' && str_starts_with($path, $basePath)) {
            $path = substr($path, strlen($basePath));
        }

        $query = (string) parse_url($url, PHP_URL_QUERY);

        return $path.($query === '' ? '' : "?{$query}");
    }

    /**
     * O último segmento do caminho que serve para reconhecer a tela. Fora identificador, fora o
     * que a URL base já carrega: esperar por segmento que toda tela do sistema tem é esperar por
     * nada, e o teste segue antes da página trocar.
     */
    private function segment(string $url): ?string
    {
        $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
        $fromBase = array_filter(explode('/', trim($this->base->path(), '/')));

        $named = array_values(array_filter(
            explode('/', $path),
            fn (string $part): bool => preg_match('/^[\w.-]+$/u', $part) === 1
                && ! $this->isIdentifier($part)
                && ! in_array($part, $fromBase, true),
        ));

        return $named === [] ? null : end($named);
    }

    private function isIdentifier(string $segment): bool
    {
        return preg_match('/^\d+$/', $segment) === 1
            || preg_match('/^[0-9a-f][0-9a-f-]{15,}$/i', $segment) === 1;
    }

    private function literal(string $value): string
    {
        return "'".str_replace(['\\', "'"], ['\\\\', "\\'"], $value)."'";
    }

    /**
     * O alvo entre aspas no título do passo: separa o que veio da tela do verbo que o descreve, e
     * assim "Clica em" e o nome do botão não se misturam numa frase só. Substantivo genérico
     * ("o campo", "o elemento") fica sem aspas de propósito — não é nome de nada.
     */
    private function quoted(string $what): string
    {
        return '"'.$what.'"';
    }
}
