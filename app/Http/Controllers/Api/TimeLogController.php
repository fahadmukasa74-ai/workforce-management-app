<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TimeLog;
use Illuminate\Http\Request;

class TimeLogController extends Controller
{
    public function index()
    {
        return response()->json(TimeLog::with('employee')->get(), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'clock_in' => 'required|date',
            'status' => 'string',
        ]);

        $timeLog = TimeLog::create($validated);
        return response()->json($timeLog, 201);
    }

    public function update(Request $request, TimeLog $timeLog)
    {
        $timeLog->update($request->all());
        return response()->json($timeLog, 200);
    }
}