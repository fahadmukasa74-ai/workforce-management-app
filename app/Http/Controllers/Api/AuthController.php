<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    // Register method with direct assignment to bypass JSON translation file errors
    public function register(Request $request)
    {
        $email = $request->input('email');
        $name = $request->input('name');
        $password = $request->input('password');

        if (!$email || !$password || !$name) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => ['email' => ['Please fill in all required fields.']]
            ], 422);
        }

        if (Employee::where('email', $email)->exists()) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => ['email' => ['The email has already been taken.']]
            ], 422);
        }

        $profilePath = null;
        if ($request->hasFile('profile_picture')) {
            $profilePath = $request->file('profile_picture')->store('profile_pictures', 'public');
        }

        $employee = Employee::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'phone' => $request->input('phone'),
            'role' => strtolower($request->input('role', 'employee')),
            'department' => $request->input('department', 'General'),
            'profile_picture' => $profilePath,
            'notifications_enabled' => true,
        ]);

        $token = $employee->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Account registered successfully',
            'token' => $token,
            'user' => $employee
        ], 201);
    }

    // Login method with detailed debugging messages if credentials fail
    public function login(Request $request)
    {
        $email = $request->input('email');
        $password = $request->input('password');

        if (!$email || !$password) {
            return response()->json([
                'message' => 'The provided credentials are incorrect.',
                'errors' => ['email' => ['Please enter email and password.']]
            ], 422);
        }

        $employee = Employee::where('email', $email)->first();

        if (! $employee) {
            return response()->json([
                'message' => 'The provided credentials are incorrect.',
                'errors' => ['email' => ['No account found with this email address. Please register first.']]
            ], 422);
        }

        if (! Hash::check($password, $employee->password)) {
            return response()->json([
                'message' => 'The provided credentials are incorrect.',
                'errors' => ['password' => ['Incorrect password entered.']]
            ], 422);
        }

        $token = $employee->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Logged in successfully',
            'token' => $token,
            'user' => $employee
        ]);
    }

    // Return full profile using token
    public function profile(Request $request)
    {
        return response()->json($request->user());
    }

    // Logout
    public function logout(Request $request)
    {
        if ($request->user() && $request->user()->currentAccessToken()) {
            $request->user()->currentAccessToken()->delete();
        }
        return response()->json(['message' => 'Logged out successfully']);
    }

    // Securely update password with strict checks
    public function updatePassword(Request $request, $id)
    {
        $currentPassword = $request->input('current_password');
        $newPassword = $request->input('new_password');

        if (!$currentPassword || !$newPassword) {
            return response()->json(['message' => 'Password fields cannot be empty.'], 422);
        }

        $employee = Employee::findOrFail($id);

        if (!Hash::check($currentPassword, $employee->password)) {
            return response()->json(['message' => 'Current password does not match.'], 422);
        }

        $employee->password = Hash::make($newPassword);
        $employee->save();

        return response()->json(['message' => 'Password updated successfully.'], 200);
    }

    // Update push notifications and device tokens preference
    public function updateNotificationPreferences(Request $request, $id)
    {
        $employee = Employee::findOrFail($id);
        
        if ($request->has('notifications_enabled')) {
            $employee->notifications_enabled = $request->input('notifications_enabled');
        }
        if ($request->has('device_token')) {
            $employee->device_token = $request->input('device_token');
        }
        $employee->save();

        return response()->json([
            'message' => 'Notification preferences updated successfully.',
            'notifications_enabled' => $employee->notifications_enabled
        ], 200);
    }

    // Fallback profile updater with safe file replacement handling
    public function updateProfile(Request $request, $id)
    {
        $employee = Employee::findOrFail($id);

        if ($request->has('name')) {
            $employee->name = $request->input('name');
        }
        if ($request->has('phone')) {
            $employee->phone = $request->input('phone');
        }
        if ($request->has('department')) {
            $employee->department = $request->input('department');
        }

        if ($request->hasFile('profile_picture')) {
            if ($employee->profile_picture) {
                $oldPath = str_replace('/storage/', '', $employee->profile_picture);
                Storage::disk('public')->delete($oldPath);
            }
            $employee->profile_picture = $request->file('profile_picture')->store('profile_pictures', 'public');
        }

        if ($request->hasFile('emirates_id_front')) {
            if ($employee->emirates_id_front) {
                $oldPath = str_replace('/storage/', '', $employee->emirates_id_front);
                Storage::disk('public')->delete($oldPath);
            }
            $employee->emirates_id_front = $request->file('emirates_id_front')->store('emirates_ids', 'public');
        }

        if ($request->hasFile('emirates_id_back')) {
            if ($employee->emirates_id_back) {
                $oldPath = str_replace('/storage/', '', $employee->emirates_id_back);
                Storage::disk('public')->delete($oldPath);
            }
            $employee->emirates_id_back = $request->file('emirates_id_back')->store('emirates_ids', 'public');
        }

        $employee->save();

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $employee
        ], 200);
    }

    // NEW: Fully working delete method with file cleanup and token revocation
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
            // Remove stored files if they exist to keep public storage clean
            if ($employee->profile_picture) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $employee->profile_picture));
            }
            if ($employee->emirates_id_front) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $employee->emirates_id_front));
            }
            if ($employee->emirates_id_back) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $employee->emirates_id_back));
            }

            // Revoke active authentication tokens
            $employee->tokens()->delete();

            // Delete the employee record
            $employee->delete();

            return response()->json([
                'success' => true,
                'message' => 'Employee account deleted successfully.'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete account: ' . $e->getMessage()
            ], 500);
        }
    }
}