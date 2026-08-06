<?php

use App\Ai\Tools\RecordedHtml;
use Illuminate\JsonSchema\JsonSchemaTypeFactory;
use Laravel\Ai\Tools\Request;

function recordedHtml(array $html = []): RecordedHtml
{
    return new RecordedHtml($html ?: [
        1 => '<div><button class="btn">Salvar</button><button class="btn">Salvar</button></div>',
        3 => '<form><input name="user"></form>',
    ]);
}

function htmlOf(RecordedHtml $tool, int $index): string
{
    return $tool->handle(new Request(['index' => $index]));
}

it('hands the agent the dom around the element of that event', function () {
    expect(htmlOf(recordedHtml(), 1))->toContain('class="btn"');
});

it('shows the sibling elements, which is what tells duplicate selectors apart', function () {
    expect(substr_count(htmlOf(recordedHtml(), 1), '<button'))->toBe(2);
});

it('reads each event by its own index, not by order of capture', function () {
    expect(htmlOf(recordedHtml(), 3))->toContain('name="user"');
});

it('says there is nothing captured for an event that had no element', function () {
    expect(htmlOf(recordedHtml(), 2))->toContain('Nenhum');
});

it('says there is nothing captured at all for a recording made before the capture existed', function () {
    expect(htmlOf(new RecordedHtml([]), 1))->toContain('Nenhum');
});

it('answers the tool contract the ai package expects', function () {
    expect((string) recordedHtml()->description())->not->toBeEmpty()
        ->and(recordedHtml()->schema(new JsonSchemaTypeFactory))->toHaveKey('index');
});
