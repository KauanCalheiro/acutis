<?php

namespace App\Http\Controllers\V1;

use App\Action\Auth\SaveAuthCredentials;
use App\Action\Auth\ShowProjectAuth;
use App\Action\Auth\SkipProjectAuth;
use App\Action\Auth\UpdateProjectAuth;
use App\Action\Auth\WriteAuthRecordingToProject;
use App\Action\Environment\ActivateProjectEnvironment;
use App\Action\Environment\CreateProjectEnvironment;
use App\Action\Environment\DeleteProjectEnvironment;
use App\Action\Environment\ListProjectEnvironments;
use App\Action\Environment\UpdateProjectEnvironment;
use App\Action\Project\CloneProjectFromGit;
use App\Action\Project\CreateProjectFromTemplate;
use App\Action\Project\DeleteProject;
use App\Action\Project\ListProjects;
use App\Action\Project\ProbeGitRepository;
use App\Action\Project\RunProject;
use App\Action\Project\ShowProject;
use App\Action\Project\SkipProjectUrl;
use App\Action\Project\UpdateProject;
use App\Action\Project\UpdateProjectSettings;
use App\Action\Recording\GenerateTestsFromRecording;
use App\Action\Recording\WriteDraftToProject;
use App\Action\Scenario\DeleteProjectScenario;
use App\Action\Scenario\FixScenarioSpec;
use App\Action\Scenario\PersistScenarioRun;
use App\Action\Scenario\ShowProjectScenario;
use App\Action\Scenario\SuggestScenarioSelectors;
use App\Action\Scenario\UpdateProjectScenario;
use App\Data\V1\Auth\AuthCredentialsData;
use App\Data\V1\Auth\AuthRecordingData;
use App\Data\V1\Auth\UpdateAuthSetupData;
use App\Data\V1\Project\CloneProjectData;
use App\Data\V1\Project\CreateProjectData;
use App\Data\V1\Project\EnvironmentData;
use App\Data\V1\Project\ProbeGitData;
use App\Data\V1\Project\ProjectSettingsData;
use App\Data\V1\Project\RunProjectData;
use App\Data\V1\Project\ScenarioFixData;
use App\Data\V1\Project\UpdateProjectData;
use App\Data\V1\Project\UpdateScenarioData;
use App\Data\V1\Recording\RecordingData;
use App\Data\V1\Recording\TestDraftData;
use App\Data\V1\Recording\WriteTestData;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\EnvironmentListResource;
use App\Http\Resources\V1\EnvironmentResource;
use App\Http\Resources\V1\FixedSpecResource;
use App\Http\Resources\V1\GeneratedAuthSetupResource;
use App\Http\Resources\V1\GitProbeResource;
use App\Http\Resources\V1\ProjectAuthResource;
use App\Http\Resources\V1\ProjectResource;
use App\Http\Resources\V1\ProjectRunResource;
use App\Http\Resources\V1\ProjectSettingsResource;
use App\Http\Resources\V1\ProjectShowResource;
use App\Http\Resources\V1\ProjectTestResource;
use App\Http\Resources\V1\ScenarioShowResource;
use App\Http\Resources\V1\SelectorSuggestionResource;
use App\Http\Resources\V1\TestDraftResource;
use App\Support\Project;
use App\Support\TestArtifact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Psr\Http\Message\StreamInterface;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $projects = ListProjects::run(
            filters: (array) $request->query('filter', []),
            search: $request->query('search'),
            sort: $request->query('sort'),
        );

        $number = max(1, (int) $request->input('page.number', 1));
        $size = min(100, max(1, (int) $request->input('page.size', 15)));

        $paginator = (new LengthAwarePaginator(
            $projects->forPage($number, $size)->values(),
            $projects->count(),
            $size,
            $number,
            ['path' => LengthAwarePaginator::resolveCurrentPath(), 'pageName' => 'page[number]'],
        ))->withQueryString();

        return ProjectResource::collection($paginator);
    }

    public function store(CreateProjectData $data): JsonResponse
    {
        $project = CreateProjectFromTemplate::run($data->name);

        return ProjectResource::make($project)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function show(string $project): ProjectShowResource
    {
        return ProjectShowResource::make(ShowProject::run($project));
    }

    public function update(string $project, UpdateProjectData $data): ProjectResource
    {
        return ProjectResource::make(UpdateProject::run($project, $data->name));
    }

    public function destroy(string $project): Response
    {
        DeleteProject::run($project);

        return response()->noContent();
    }

    public function probe(ProbeGitData $data): GitProbeResource
    {
        return GitProbeResource::make(['public' => ProbeGitRepository::run($data->url)]);
    }

    public function clone(CloneProjectData $data): JsonResponse
    {
        $project = CloneProjectFromGit::run($data);

        return ProjectResource::make($project)
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function updateSettings(string $project, ProjectSettingsData $data): ProjectSettingsResource
    {
        return ProjectSettingsResource::make(UpdateProjectSettings::run($project, $data));
    }

    public function skipUrl(string $project): Response
    {
        SkipProjectUrl::run($project);

        return response()->noContent();
    }

    public function environments(string $project): EnvironmentListResource
    {
        return EnvironmentListResource::make(ListProjectEnvironments::run($project));
    }

    public function storeEnvironment(string $project, EnvironmentData $data): JsonResponse
    {
        return EnvironmentResource::make(CreateProjectEnvironment::run($project, $data->name))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    public function updateEnvironment(string $project, string $environment, EnvironmentData $data): EnvironmentResource
    {
        return EnvironmentResource::make(UpdateProjectEnvironment::run($project, $environment, $data));
    }

    public function activateEnvironment(string $project, string $environment): EnvironmentResource
    {
        return EnvironmentResource::make(ActivateProjectEnvironment::run($project, $environment));
    }

    public function destroyEnvironment(string $project, string $environment): Response
    {
        DeleteProjectEnvironment::run($project, $environment);

        return response()->noContent();
    }

    public function authCredentials(string $project, AuthCredentialsData $data): Response
    {
        SaveAuthCredentials::run($project, $data);

        return response()->noContent();
    }

    public function showAuth(string $project): ProjectAuthResource
    {
        return ProjectAuthResource::make(ShowProjectAuth::run($project));
    }

    public function showScenario(string $project, string $scenario): ScenarioShowResource
    {
        return ScenarioShowResource::make(ShowProjectScenario::run($project, $scenario));
    }

    public function destroyScenario(string $project, string $scenario): Response
    {
        DeleteProjectScenario::run($project, $scenario);

        return response()->noContent();
    }

    public function updateScenario(string $project, string $scenario, UpdateScenarioData $data): ScenarioShowResource
    {
        return ScenarioShowResource::make(UpdateProjectScenario::run($project, $scenario, $data));
    }

    public function suggestScenarioSelectors(string $project, string $scenario): AnonymousResourceCollection
    {
        return SelectorSuggestionResource::collection(SuggestScenarioSelectors::run($project, $scenario));
    }

    public function fixScenario(string $project, string $scenario, ScenarioFixData $data): FixedSpecResource
    {
        return FixedSpecResource::make(FixScenarioSpec::run($project, $scenario, $data));
    }

    public function updateAuth(string $project, UpdateAuthSetupData $data): ProjectAuthResource
    {
        return ProjectAuthResource::make(UpdateProjectAuth::run($project, $data->authSetup));
    }

    public function skipAuth(string $project): Response
    {
        SkipProjectAuth::run($project);

        return response()->noContent();
    }

    public function recordAuth(string $project, AuthRecordingData $data): GeneratedAuthSetupResource
    {
        return GeneratedAuthSetupResource::make(WriteAuthRecordingToProject::run($project, $data));
    }

    public function testsDraft(string $project, RecordingData $data): TestDraftResource
    {
        $path = Project::make($project)->path();

        $generated = GenerateTestsFromRecording::run($project, $data);
        $title = TestArtifact::title($generated->gherkin);

        return TestDraftResource::make(new TestDraftData(
            title: $title,
            tags: TestArtifact::tags($generated->gherkin),
            domain: $generated->domain,
            path: TestArtifact::uniquePath("{$path}/tests", Str::slug($title) ?: 'teste'),
            gherkin: $generated->gherkin,
            playwright: $generated->playwright,
            envVars: $generated->envVars,
            warnings: $generated->warnings,
        ));
    }

    public function tests(string $project, WriteTestData $data): ProjectTestResource
    {
        return ProjectTestResource::make(WriteDraftToProject::run($project, $data));
    }

    public function run(string $project, RunProjectData $data): ProjectRunResource
    {
        return ProjectRunResource::make(RunProject::run($project, $data->spec, $data->grep));
    }

    public function runStream(string $project, Request $request): StreamedResponse
    {
        $resolved = Project::make($project);
        $path = $resolved->path();
        $spec = $request->query('spec');
        $grep = $request->query('grep');
        $environment = $resolved->environments()->resolve();

        return response()->stream(function () use ($path, $spec, $grep, $environment): void {
            set_time_limit(0);

            $startedAt = now();
            $events = [];

            $body = Http::withOptions(['stream' => true])
                ->timeout(600)
                ->post(acutis()->webdriverUrl.'/runner/project/stream', [
                    'path' => $path,
                    'spec' => $spec,
                    'grep' => $grep,
                    'env' => blank($environment) ? null : $environment,
                ])
                ->toPsrResponse()
                ->getBody();

            $stream = $this->unbufferedStream($body);

            while (($line = fgets($stream)) !== false) {
                $line = trim($line);

                if ($line === '') {
                    continue;
                }

                echo "data: {$line}\n\n";

                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();

                $event = json_decode($line, true);

                if (filled($event)) {
                    $events[] = $event;
                }
            }

            fclose($stream);

            if (filled($spec)) {
                PersistScenarioRun::run($path, $spec, $events, $startedAt);
            }
        }, Response::HTTP_OK, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /** @return resource */
    private function unbufferedStream(StreamInterface $body)
    {
        $stream = $body->detach();

        stream_set_chunk_size($stream, 1);

        return $stream;
    }
}
