<?php

namespace App\Http\Controllers\V1;

use App\Action\CloneProjectFromGit;
use App\Action\CreateProjectFromTemplate;
use App\Action\DeleteProject;
use App\Action\ListProjects;
use App\Action\ProbeGitRepository;
use App\Action\ShowProject;
use App\Action\UpdateProject;
use App\Action\RunProject;
use App\Action\ShowProjectAuth;
use App\Action\ShowProjectScenario;
use App\Action\UpdateProjectScenario;
use App\Action\DeleteProjectScenario;
use App\Action\SkipProjectAuth;
use App\Action\UpdateProjectAuth;
use App\Action\WriteAuthRecordingToProject;
use App\Action\WriteAuthSetupToProject;
use App\Action\GenerateTestsFromRecording;
use App\Action\WriteDraftToProject;
use App\Data\V1\Auth\AuthRecordingData;
use App\Data\V1\Auth\AuthSetupData;
use App\Data\V1\Auth\UpdateAuthSetupData;
use App\Data\V1\Project\CloneProjectData;
use App\Data\V1\Project\CreateProjectData;
use App\Data\V1\Project\ProbeGitData;
use App\Data\V1\Project\UpdateProjectData;
use App\Data\V1\Project\UpdateScenarioData;
use App\Data\V1\Project\RunProjectData;
use App\Data\V1\Recording\RecordingData;
use App\Data\V1\Recording\TestDraftData;
use App\Data\V1\Recording\WriteTestData;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\GeneratedAuthSetupResource;
use App\Http\Resources\V1\GitProbeResource;
use App\Http\Resources\V1\ProjectShowResource;
use App\Http\Resources\V1\ProjectResource;
use App\Http\Resources\V1\ProjectAuthResource;
use App\Http\Resources\V1\ProjectRunResource;
use App\Http\Resources\V1\ProjectTestResource;
use App\Http\Resources\V1\ScenarioShowResource;
use App\Http\Resources\V1\TestDraftResource;
use App\Support\TestArtifact;
use Illuminate\Support\Str;
use App\Support\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Http;
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

    public function auth(string $project, AuthSetupData $data): GeneratedAuthSetupResource
    {
        return GeneratedAuthSetupResource::make(WriteAuthSetupToProject::run($project, $data));
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
        $path = Project::path($project);

        $generated = GenerateTestsFromRecording::run($data);
        $title = TestArtifact::title($generated->gherkin);

        return TestDraftResource::make(new TestDraftData(
            title: $title,
            tags: TestArtifact::tags($generated->gherkin),
            domain: $generated->domain,
            path: TestArtifact::uniquePath("{$path}/tests", Str::slug($title) ?: 'teste'),
            gherkin: $generated->gherkin,
            playwright: $generated->playwright,
            envVars: $generated->envVars,
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
        $path = Project::path($project);
        $spec = $request->query('spec');
        $grep = $request->query('grep');

        return response()->stream(function () use ($path, $spec, $grep): void {
            $body = Http::withOptions(['stream' => true])
                ->timeout(600)
                ->post(acutis()->webdriverUrl.'/runner/project/stream', [
                    'path' => $path,
                    'spec' => $spec,
                    'grep' => $grep,
                ])
                ->toPsrResponse()
                ->getBody();

            $buffer = '';

            while (! $body->eof()) {
                $buffer .= $body->read(1024);

                while (($newline = strpos($buffer, "\n")) !== false) {
                    $line = substr($buffer, 0, $newline);
                    $buffer = substr($buffer, $newline + 1);

                    if (trim($line) === '') {
                        continue;
                    }

                    echo "data: {$line}\n\n";

                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }
            }
        }, Response::HTTP_OK, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
