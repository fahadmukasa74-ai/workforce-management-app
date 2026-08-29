<?php

use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\TimeLogController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ShiftSyncController;
use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Unprotected routes for profile preferences & settings updates
Route::put('/users/{id}/password', [AuthController::class, 'updatePassword']);
Route::put('/users/{id}/notifications', [AuthController::class, 'updateNotificationPreferences']);

// Profile & document uploads handled via ProfileController
Route::post('/users/{id}/profile', [ProfileController::class, 'update']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user-profile', [AuthController::class, 'profile']);
    Route::post('/logout', [AuthController::class, 'logout']);
    
    // Get the employee profile for the currently authenticated user
    Route::get('/employees/me', [EmployeeController::class, 'me']);
});

// Shift & Roster Management API Endpoints with Supabase Cloud Sync
Route::prefix('v1')->group(function () {
    Route::get('/shifts', [ShiftSyncController::class, 'getShifts']);
    Route::post('/shifts/upsert', [ShiftSyncController::class, 'upsertShift']);
    Route::patch('/shifts/{id}/status', [ShiftSyncController::class, 'updateShiftStatus']);
});

Route::apiResource('employees', EmployeeController::class);
Route::apiResource('time-logs', TimeLogController::class);
Route::apiResource('leaves', LeaveController::class);