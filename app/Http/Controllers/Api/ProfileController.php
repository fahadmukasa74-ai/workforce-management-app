<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProfileController extends Controller
{
    public function update(Request $request, $id)
    {
        try {
            $employee = Employee::findOrFail($id);

            $employee->name = $request->input('name', $employee->name);
            $employee->phone = $request->input('phone', $employee->phone);
            $employee->department = $request->input('department', $employee->department);

            $saveBase64 = function ($base64String, $folder) {
                if (!$base64String || !preg_match('/^data:image\/(\w+);base64,/', $base64String, $type)) {
                    return null;
                }
                
                $imageParts = explode(',', $base64String);
                $decodedImage = base64_decode(end($imageParts));
                if ($decodedImage === false) {
                    return null;
                }

                $extension = strtolower($type[1]);
                $filename = Str::random(40) . '.' . $extension;
                $path = "{$folder}/{$filename}";
                
                Storage::disk('public')->put($path, $decodedImage);
                return $path;
            };

            if ($request->filled('profile_picture') && str_starts_with($request->input('profile_picture'), 'data:image')) {
                if ($employee->profile_picture) {
                    Storage::disk('public')->delete($employee->profile_picture);
                }
                $employee->profile_picture = $saveBase64($request->input('profile_picture'), 'profile_pictures');
            }

            if ($request->filled('emirates_id_front') && str_starts_with($request->input('emirates_id_front'), 'data:image')) {
                if ($employee->emirates_id_front) {
                    Storage::disk('public')->delete($employee->emirates_id_front);
                }
                $employee->emirates_id_front = $saveBase64($request->input('emirates_id_front'), 'emirates_ids');
            }

            if ($request->filled('emirates_id_back') && str_starts_with($request->input('emirates_id_back'), 'data:image')) {
                if ($employee->emirates_id_back) {
                    Storage::disk('public')->delete($employee->emirates_id_back);
                }
                $employee->emirates_id_back = $saveBase64($request->input('emirates_id_back'), 'emirates_ids');
            }

            $employee->save();

            return response()->json([
                'message' => 'Profile updated successfully.',
                'user' => $employee
            ], 200)
            ->header('Access-Control-Allow-Origin', 'http://localhost:8081')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Server error occurred.',
                'error' => $e->getMessage()
            ], 500)
            ->header('Access-Control-Allow-Origin', 'http://localhost:8081')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        }
    }
}