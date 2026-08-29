<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Leave;
use Illuminate\Http\Request;

class LeaveController extends Controller
{
    public function index()
    {
        return response()->json(Leave::with('employee')->get(), 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'leave_type' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $leave = Leave::create($validated);
        return response()->json($leave, 201);
    }

    public function update(Request $request, Leave $leave)
    {
        $leave->update($request->all());
        return response()->json($leave, 200);
    }
}