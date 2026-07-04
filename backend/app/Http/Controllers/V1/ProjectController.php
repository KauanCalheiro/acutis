<?php

namespace App\Http\Controllers\V1;

use App\Action\CloneProjectFromGit;
use App\Action\CreateAuthenticatedProject;
use App\Action\CreateProjectFromTemplate;
use App\Action\ListProjects;
use App\Data\V1\Auth\CreateAuthProjectData;
use App\Data\V1\Project\CloneProjectData;
use App\Data\V1\Project\CreateProjectData;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\CreatedAuthProjectResource;
use App\Http\Resources\V1\ProjectResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Pagination\LengthAwarePaginator;
use Symfony\Component\HttpFoundation\Response;

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

    public function auth(CreateAuthProjectData $data): JsonResponse
    {
        return CreatedAuthProjectResource::make(CreateAuthenticatedProject::run($data))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }
}
