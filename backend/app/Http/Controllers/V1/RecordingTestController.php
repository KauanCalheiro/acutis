<?php

namespace App\Http\Controllers\V1;

use App\Action\GenerateTestsFromRecording;
use App\Data\V1\Recording\RecordingData;
use App\Http\Controllers\Controller;
use App\Http\Resources\V1\GeneratedTestsResource;

class RecordingTestController extends Controller
{
    public function store(RecordingData $data): GeneratedTestsResource
    {
        return GeneratedTestsResource::make(GenerateTestsFromRecording::run($data));
    }
}
