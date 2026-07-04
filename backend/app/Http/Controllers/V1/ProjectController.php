<?php

namespace App\Http\Controllers\V1;

use App\Action\CloneProjectFromGit;
use App\Action\CreateProjectFromTemplate;
use App\Action\ListProjects;
use App\Action\RunProject;
use App\Action\WriteAuthSetupToProject;
use App\Action\WriteTestToProject;
use App\Data\V1\Auth\AuthSetupData;
use App\Data\V1\Project\CloneProjectData;
use App\Data\V1\Project\CreateProjectData;
use App\Data\V1\Project\RunProjectData;
use App\Data\V1\Recording\RecordingData;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\GeneratedAuthSetupResource;
use App\Http\Resources\V1\ProjectResource;
use App\Http\Resources\V1\ProjectRunResource;
use App\Http\Resources\V1\ProjectTestResource;
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

    public function tests(string $project, RecordingData $data): ProjectTestResource
    {
        return ProjectTestResource::make(WriteTestToProject::run($project, $data));
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
