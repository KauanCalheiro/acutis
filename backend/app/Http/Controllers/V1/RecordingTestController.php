<?php

namespace App\Http\Controllers\V1;

use App\Action\GenerateTestsFromRecording;
use App\Data\V1\Recording\RecordingData;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class RecordingTestController extends Controller
{
    public function store(RecordingData $data): JsonResponse
    {
        return response()->json(GenerateTestsFromRecording::run($data));
    }
}
