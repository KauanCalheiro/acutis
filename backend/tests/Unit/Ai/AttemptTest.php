<?php

use App\Ai\Attempt;
use App\Ai\StructuredOutput;
use Laravel\Ai\Responses\Data\Meta;
use Laravel\Ai\Responses\Data\Usage;
use Laravel\Ai\Responses\StructuredTextResponse;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

function resposta(string $texto): StructuredTextResponse
{
    return new StructuredTextResponse([], $texto, new Usage, new Meta('gemini', 'x'));
}

it('takes the first answer when it already carries the field', function () {
    $chamadas = 0;

    $response = Attempt::answering(function () use (&$chamadas) {
        $chamadas++;

        return resposta('{"playwright": "spec"}');
    }, 'playwright');

    expect(StructuredOutput::field($response, 'playwright'))->toBe('spec')
        ->and($chamadas)->toBe(1);
});

it('asks again when the agent came back empty, since the next try starts with a full budget', function () {
    $chamadas = 0;

    $response = Attempt::answering(function () use (&$chamadas) {
        $chamadas++;

        return resposta($chamadas === 1 ? '' : '{"playwright": "na segunda"}');
    }, 'playwright');

    expect(StructuredOutput::field($response, 'playwright'))->toBe('na segunda')
        ->and($chamadas)->toBe(2);
});

it('asks again when the answer came in a shape without the field', function () {
    $chamadas = 0;

    $response = Attempt::answering(function () use (&$chamadas) {
        $chamadas++;

        return resposta($chamadas === 1 ? '{"outro": "campo"}' : '{"playwright": "na segunda"}');
    }, 'playwright');

    expect(StructuredOutput::field($response, 'playwright'))->toBe('na segunda');
});

it('gives up at the limit instead of asking forever', function () {
    $chamadas = 0;

    expect(function () use (&$chamadas) {
        Attempt::answering(function () use (&$chamadas) {
            $chamadas++;

            return resposta('');
        }, 'playwright');
    })->toThrow(UnprocessableEntityHttpException::class);

    expect($chamadas)->toBe(2);
});

it('says what happened in words the person on the other side can act on', function () {
    try {
        Attempt::answering(fn () => resposta(''), 'playwright');
    } catch (UnprocessableEntityHttpException $e) {
        expect($e->getMessage())->toContain('Tente de novo');
    }
});
