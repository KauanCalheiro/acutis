<?php

use App\Ai\Agents\Auth\AuthFixer;
use App\Ai\Agents\Auth\AuthValidator;
use App\Ai\Agents\Scenario\ScenarioFixer;
use App\Ai\Agents\Scenario\ScenarioValidator;
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

    File::ensureDirectoryExists($this->dir.'/environments');
    File::put($this->dir.'/environments/ambiente.json', json_encode([
        'name' => 'Ambiente',
        'vars' => [['key' => EnvKey::URL->value, 'value' => 'https://app.test', 'secret' => false]],
    ]));
});

beforeEach(function () {
    fakeCleanValidator(ScenarioValidator::class);
    fakeCleanValidator(AuthValidator::class);
});

afterEach(function () {
    File::deleteDirectory($this->projectsPath);
});

function fakeFix(?string $playwright = null): void
{
    Http::fake(['*/runner/spec' => Http::response([
        'passed' => false,
        'output' => "locator('#v-0') resolved to hidden",
        'html' => '<form><input data-testid="login-usuario" name="user"></form>',
    ])]);

    ScenarioFixer::fake([[
        'playwright' => $playwright ?? "await page.getByTestId('login-usuario').fill('482910')",
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

it('prompts the agent with the failing step, the error, the spec and the broken page', function () {
    fakeFix();

    postJson('/api/v1/projects/minha-loja/scenarios/login/fix', [
        'step' => 'Quando preencho o campo "Usuário ou código"',
        'error' => "locator('#v-0') resolved to hidden",
    ])->assertOk();

    ScenarioFixer::assertPrompted(function ($prompt) {
        $payload = promptPayload($prompt);

        return $payload['run']['step'] === 'Quando preencho o campo "Usuário ou código"'
            && str_contains($payload['run']['error'], "locator('#v-0') resolved to hidden")
            && str_contains($payload['spec'], "page.locator('#v-0')")
            && str_contains($payload['html'], 'login-usuario');
    });
});

it('runs the failing spec once, so the html it hands over is the page as it broke', function () {
    fakeFix();

    postJson('/api/v1/projects/minha-loja/scenarios/login/fix', [
        'step' => 'passo',
        'error' => 'erro',
    ])->assertOk();

    Http::assertSent(fn ($request) => str_contains($request->url(), '/runner/spec')
        && str_contains($request['spec'], "page.locator('#v-0')"));
});

it('gives the fixer the original events so it can confirm the intent of the step', function () {
    fakeFix();

    postJson('/api/v1/projects/minha-loja/scenarios/login/fix', [
        'step' => 'passo',
        'error' => 'erro',
    ])->assertOk();

    ScenarioFixer::assertPrompted(
        fn ($prompt) => collect(promptPayload($prompt)['events'])->contains('label', 'Usuário ou código')
    );
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

it('fixes the auth setup with the auth fixer, reading its recorded events', function () {
    File::put($this->dir.'/tests/auth.setup.ts', "await page.locator('#v-9').fill(process.env.".EnvKey::USER->value.')');
    File::put($this->dir.'/tests/auth.events.json', json_encode([
        ['type' => 'fill', 'label' => 'Matrícula', 'url' => 'https://app.test/login', 'selectors' => ['id' => 'v-9']],
    ]));

    Http::fake(['*/runner/spec' => Http::response(['passed' => false, 'output' => 'erro', 'html' => '<form></form>'])]);
    AuthFixer::fake([[
        'playwright' => "await page.getByTestId('login-matricula').fill(process.env.".EnvKey::USER->value.')',
        'summary' => 'Troquei o id gerado pelo data-testid.',
    ]]);

    postJson('/api/v1/projects/minha-loja/scenarios/auth/fix', [
        'step' => 'login',
        'error' => "locator('#v-9') resolved to hidden",
    ])->assertOk();

    AuthFixer::assertPrompted(function ($prompt) {
        $payload = promptPayload($prompt);

        return str_contains($payload['spec'], "page.locator('#v-9')")
            && collect($payload['events'])->contains('label', 'Matrícula');
    });
});

it('sends a fix that checks the url by exact equality back for another pass', function () {
    $url = EnvKey::URL->value;

    Http::fake(['*/runner/spec' => Http::response(['passed' => false, 'output' => 'erro', 'html' => '<form></form>'])]);
    ScenarioFixer::fake([
        ['playwright' => "await expect(page).toHaveURL(`\${process.env.{$url}}/entrar`)", 'summary' => 'primeira tentativa'],
        ['playwright' => 'await expect(page).toHaveURL(/\/entrar/)', 'summary' => 'segunda tentativa'],
    ]);

    postJson('/api/v1/projects/minha-loja/scenarios/login/fix', [
        'step' => 'passo',
        'error' => 'erro',
    ])
        ->assertOk()
        ->assertJsonPath('summary', 'segunda tentativa');
});

it('returns 404 for the auth setup when the project has none', function () {
    postJson('/api/v1/projects/minha-loja/scenarios/auth/fix', [
        'step' => 'passo',
        'error' => 'erro',
    ])->assertNotFound();
});
