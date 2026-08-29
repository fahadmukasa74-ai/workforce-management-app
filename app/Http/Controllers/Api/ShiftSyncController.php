<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ShiftSyncController extends Controller
{
    /**
     * Fetch all shifts or filter by employee email/ID from Supabase.
     */
    public function getShifts(Request $request)
    {
        try {
            $email = $request->query('email');
            $employeeId = $request->query('employee_id');

            $query = DB::connection('supabase')->table('shifts');

            if ($email) {
                $query->where('employee_email', 'ilike', trim($email));
            }

            if ($employeeId) {
                $query->orWhere('employee_id', $employeeId);
            }

            $shifts = $query->get();

            return response()->json([
                'success' => true,
                'data' => $shifts
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch shifts from cloud database.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create or update a shift / swap request record in Supabase.
     */
    public function upsertShift(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|string',
            'employee_id' => 'required|string',
            'employee_name' => 'required|string',
            'shift_date' => 'required|string',
            'start_time' => 'required|string',
            'end_time' => 'required|string',
            'status' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $data = $request->only([
                'id',
                'employee_id',
                'employee_name',
                'employee_email',
                'role',
                'shift_date',
                'start_time',
                'end_time',
                'total_hours',
                'department',
                'status',
                'location'
            ]);

            // Upsert into Supabase shifts table via PostgreSQL connection
            DB::connection('supabase')->table('shifts')->updateOrInsert(
                ['id' => $data['id']],
                array_merge($data, ['updated_at' => now()])
            );

            return response()->json([
                'success' => true,
                'message' => 'Shift synchronized successfully with Supabase cloud.'
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to sync shift data.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Handle shift status updates (e.g., Swap Requested).
     */
    public function updateShiftStatus(Request $request, $id)
    {
        try {
            $status = $request->input('status');

            $updated = DB::connection('supabase')
                ->table('shifts')
                .where('id', $id)
                ->update([
                    'status' => $status,
                    'updated_at' => now()
                ]);

            if ($updated) {
                return response()->json([
                    'success' => true,
                    'message' => 'Shift status updated successfully.'
                ], 200);
            }

            return response()->json([
                'success' => false,
                'message' => 'Shift record not found.'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update shift status.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}