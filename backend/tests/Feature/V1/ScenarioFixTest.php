<?php

use App\Ai\Agents\SpecFixer;
use App\Enums\EnvKey;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

use function Pest\Laravel\postJson;

beforeEach(function () {
    $this->projectsPath = sys_get_temp_dir().'/acutis-test-'.uniqid();
    config()->set('acutis.projects.path', $this->projectsPath);

    $this->dir = $this->projectsPath.'/minha-loja';
    File::ensureDirectoryExists($this->dir.'/tests');
    File::put($this->dir.'/acutis.json', json_encode([
        'name' => 'Minha Loja',
        'slug' => 'minha-loja',
        'created_at' => '2026-01-01T00:00:00+00:00',
        'version' => 1,
    ]));
    File::put($this->dir.'/tests/login.spec.ts', "await page.locator('#v-0').fill('482910')");
    File::put($this->dir.'/tests/login.events.json', json_encode([
        ['type' => 'fill', 'label' => 'Usuário ou código', 'url' => 'https://app.test/login', 'selectors' => ['id' => 'v-0']],
    ]));
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function fakeFix(): void
{
    Http::fake(['*/runner/snapshot' => Http::response([
        'elements' => [['tag' => 'input', 'label' => 'Usuário ou código', 'testId' => 'login-usuario']],
    ])]);

    SpecFixer::fake([[
        'playwright' => "await page.getByTestId('login-usuario').fill('482910')",
        'summary' => 'Troquei o id gerado #v-0 pelo data-testid login-usuario.',
    ]]);
}

it('proposes a fixed spec from the failing step', function () {
    fakeFix();

    postJson('/api/v1/projects/minha-loja/scenarios/login/fix', [
        'step' => 'Quando preencho o campo "Usuário ou código"',
        'error' => "locator('#v-0') resolved to hidden",
    ])
        ->assertOk()
        ->assertJsonPath('playwright', "await page.getByTestId('login-usuario').fill('482910')")
        ->assertJsonPath('summary', 'Troquei o id gerado #v-0 pelo data-testid login-usuario.');
});

it('prompts the agent with the failing step, the error, the spec and the snapshot', function () {
    fakeFix();

    postJson('/api/v1/projects/minha-loja/scenarios/login/fix', [
        'step' => 'Quando preencho o campo "Usuário ou código"',
        'error' => "locator('#v-0') resolved to hidden",
    ])->assertOk();

    SpecFixer::assertPrompted(fn ($prompt) => str_contains($prompt->prompt, 'Quando preencho o campo "Usuário ou código"')
        && str_contains($prompt->prompt, "locator('#v-0') resolved to hidden")
        && str_contains($prompt->prompt, "page.locator('#v-0')")
        && str_contains($prompt->prompt, 'login-usuario'));
});

it('does not write the proposal to disk', function () {
    fakeFix();

    postJson('/api/v1/projects/minha-loja/scenarios/login/fix', [
        'step' => 'passo',
        'error' => 'erro',
    ])->assertOk();

    expect(File::get($this->dir.'/tests/login.spec.ts'))->toBe("await page.locator('#v-0').fill('482910')");
});

it('requires the failing step and the error', function () {
    postJson('/api/v1/projects/minha-loja/scenarios/login/fix', [])
        ->assertStatus(422);
});

it('returns 404 for a scenario that does not exist', function () {
    postJson('/api/v1/projects/minha-loja/scenarios/inexistente/fix', [
        'step' => 'passo',
        'error' => 'erro',
    ])->assertNotFound();
});

it('fixes the auth setup with the same agent, reading its recorded events', function () {
    fakeFix();
    File::put($this->dir.'/tests/auth.setup.ts', "await page.locator('#v-9').fill(process.env.".EnvKey::USER->value.')');
    File::put($this->dir.'/tests/auth.events.json', json_encode([
        ['type' => 'fill', 'label' => 'Matrícula', 'url' => 'https://app.test/login', 'selectors' => ['id' => 'v-9']],
    ]));

    postJson('/api/v1/projects/minha-loja/scenarios/auth/fix', [
        'step' => 'login',
        'error' => "locator('#v-9') resolved to hidden",
    ])->assertOk();

    SpecFixer::assertPrompted(fn ($prompt) => str_contains($prompt->prompt, "page.locator('#v-9')")
        && str_contains($prompt->prompt, 'Matrícula'));
});

it('has the fix check the url by pattern, never by exact equality', function () {
    expect(app(SpecFixer::class)->instructions())->toContain('toHaveURL(/');
});

it('returns 404 for the auth setup when the project has none', function () {
    postJson('/api/v1/projects/minha-loja/scenarios/auth/fix', [
        'step' => 'passo',
        'error' => 'erro',
    ])->assertNotFound();
});
