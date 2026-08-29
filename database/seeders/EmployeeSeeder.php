<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Employee;
use App\Models\TimeLog;

class EmployeeSeeder extends Seeder
{
    public function run(): void
    {
        $employee1 = Employee::create([
            'name' => 'Fahad Mukasa',
            'email' => 'fahad@example.com',
            'role' => 'admin',
            'department' => 'Engineering',
        ]);

        $employee2 = Employee::create([
            'name' => 'Jane Smith',
            'email' => 'jane@example.com',
            'role' => 'employee',
            'department' => 'Operations',
        ]);

        TimeLog::create([
            'employee_id' => $employee1->id,
            'clock_in' => now()->subHours(8),
            'clock_out' => now(),
            'status' => 'on-time',
        ]);
    }
}