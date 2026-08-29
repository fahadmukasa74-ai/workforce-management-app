<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class EmployeeController extends Controller
{
    public function index()
    {
        return response()->json(Employee::all(), 200);
    }

    // Fetch currently authenticated user's employee record dynamically
    public function me(Request $request)
    {
        $employee = $request->user()->employee ?? $request->user();

        return response()->json([
            'success' => true,
            'data' => $employee
        ], 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:employees,email',
            'role' => 'required|string',
            'department' => 'required|string',
        ]);

        $employee = Employee::create($validated);
        return response()->json($employee, 201);
    }

    public function show(Employee $employee)
    {
        return response()->json($employee, 200);
    }

    public function update(Request $request, Employee $employee)
    {
        $employee->update($request->all());
        return response()->json($employee, 200);
    }

    // Editable profile update method storing images under custom public directories
    public function updateProfile(Request $request, $id)
    {
        $employee = Employee::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'department' => 'nullable|string|max:100',
            'profile_picture' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
            'emirates_id_front' => 'nullable|image|mimes:jpeg,png,jpg|max:3072',
            'emirates_id_back' => 'nullable|image|mimes:jpeg,png,jpg|max:3072',
        ]);

        $employee->name = $validated['name'];
        $employee->phone = $request->phone ?? $employee->phone;
        $employee->department = $request->department ?? $employee->department;

        // Save Profile Picture under profile_pictures/ and store relative path
        if ($request->hasFile('profile_picture')) {
            if ($employee->profile_picture) {
                $oldPath = str_replace('/storage/', '', $employee->profile_picture);
                Storage::disk('public')->delete($oldPath);
            }
            $path = $request->file('profile_picture')->store('profile_pictures', 'public');
            $employee->profile_picture = $path;
        }

        // Save Emirates ID Front under emirates_ids/ and store relative path
        if ($request->hasFile('emirates_id_front')) {
            if ($employee->emirates_id_front) {
                $oldPath = str_replace('/storage/', '', $employee->emirates_id_front);
                Storage::disk('public')->delete($oldPath);
            }
            $path = $request->file('emirates_id_front')->store('emirates_ids', 'public');
            $employee->emirates_id_front = $path;
        }

        // Save Emirates ID Back under emirates_ids/ and store relative path
        if ($request->hasFile('emirates_id_back')) {
            if ($employee->emirates_id_back) {
                $oldPath = str_replace('/storage/', '', $employee->emirates_id_back);
                Storage::disk('public')->delete($oldPath);
            }
            $path = $request->file('emirates_id_back')->store('emirates_ids', 'public');
            $employee->emirates_id_back = $path;
        }

        $employee->save();

        return response()->json([
            'message' => 'Profile and documents updated successfully.',
            'user' => $employee
        ], 200);
    }

    // Fully working delete method with file cleanup
    public function destroy($id)
    {
        $employee = Employee::find($id);

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee not found.'
            ], 404);
        }

        try {
            // Delete associated profile picture from storage if it exists
            if ($employee->profile_picture) {
                $oldProfilePic = str_replace('/storage/', '', $employee->profile_picture);
                Storage::disk('public')->delete($oldProfilePic);
            }

            // Delete associated Emirates ID front image if it exists
            if ($employee->emirates_id_front) {
                $oldIdFront = str_replace('/storage/', '', $employee->emirates_id_front);
                Storage::disk('public')->delete($oldIdFront);
            }

            // Delete associated Emirates ID back image if it exists
            if ($employee->emirates_id_back) {
                $oldIdBack = str_replace('/storage/', '', $employee->emirates_id_back);
                Storage::disk('public')->delete($oldIdBack);
            }

            // Delete the employee record from the database
            $employee->delete();

            return response()->json([
                'success' => true,
                'message' => 'Employee and associated documents deleted successfully.'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete employee: ' . $e->getMessage()
            ], 500);
        }
    }
}