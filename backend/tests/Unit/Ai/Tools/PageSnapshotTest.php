<?php

use App\Ai\Tools\PageSnapshot;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Tools\Request;

function snapshotOf(string $url = 'https://sistema.test/intranet/login'): string
{
    return (new PageSnapshot)->handle(new Request(['url' => $url]));
}

it('hands the agent the elements the real page actually has', function () {
    Http::fake(['*/runner/snapshot' => Http::response([
        ['role' => 'button', 'name' => 'Entrar', 'testId' => 'login-entrar'],
    ])]);

    expect(snapshotOf())->toContain('login-entrar');
});

it('asks the webdriver for the url the agent named', function () {
    Http::fake(['*/runner/snapshot' => Http::response([])]);

    snapshotOf('https://sistema.test/intranet/produtos');

    Http::assertSent(fn ($request) => $request['url'] === 'https://sistema.test/intranet/produtos');
});

it('tells the agent the page could not be captured instead of throwing', function () {
    Http::fake(['*/runner/snapshot' => Http::response('', 500)]);

    expect(snapshotOf())->toContain('Não foi possível');
});

it('answers the tool contract the ai package expects', function () {
    $tool = new PageSnapshot;

    expect((string) $tool->description())->not->toBeEmpty()
        ->and($tool->schema(new JsonSchemaTypeFactory))->toHaveKey('url');
});
