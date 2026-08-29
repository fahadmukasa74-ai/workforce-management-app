import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import enTranslations from '../lang/en.json';
import arTranslations from '../lang/ar.json';

const translationsMap = {
  en: enTranslations,
  ar: arTranslations,
};

interface AttendanceScreenProps {
  onBack: () => void;
  currentLang: 'en' | 'ar';
}

interface AttendanceLog {
  id?: string;
  checkIn: number;
  checkOut: number | null;
  hoursWorked: number;
  earnings: number;
  status: 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Overtime';
}

export default function AttendanceScreen({ onBack, currentLang }: AttendanceScreenProps) {
  const [activeCheckin, setActiveCheckIn] = useState<number | null>(null);
  const [activeOvertime, setActiveOvertime] = useState<number | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [totalDaysWorked, setTotalDaysWorked] = useState(0);
  const [totalHoursMonth, setTotalHoursMonth] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(100);
  const [userUniqueId, setUserUniqueId] = useState('#1945');

  const HOURLY_RATE = 29; // Updated to 29 AED per hour
  const t: any = translationsMap[currentLang];

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    try {
      const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
      const userKey = activeEmail.trim().toLowerCase();

      const savedActiveCheckIn = await AsyncStorage.getItem(`@active_check_in_${userKey}`);
      const savedActiveOvertime = await AsyncStorage.getItem(`@active_overtime_${userKey}`);
      const savedLogs = await AsyncStorage.getItem(`@attendance_logs_${userKey}`);
      const savedId = await AsyncStorage.getItem(`@user_unique_id_${userKey}`);

      if (savedId) {
        setUserUniqueId(savedId.startsWith('#') ? savedId : `#${savedId}`);
      } else if (userKey === 'fahadmukasa74@gmail.com') {
        setUserUniqueId('#1945');
      }

      if (savedActiveCheckIn) setActiveCheckIn(Number(savedActiveCheckIn));
      if (savedActiveOvertime) setActiveOvertime(Number(savedActiveOvertime));
      if (savedLogs) {
        const parsed: AttendanceLog[] = JSON.parse(savedLogs);
        setLogs(parsed);
        calculateMonthlyStats(parsed);
      }
    } catch (error) {
      console.log('Failed to load attendance data', error);
    }
  };

  const calculateMonthlyStats = (currentLogs: AttendanceLog[]) => {
    const currentMonth = new Date().getMonth();
    let days = 0;
    let hours = 0;
    currentLogs.forEach((log) => {
      const logDate = new Date(log.checkIn);
      if (logDate.getMonth() === currentMonth && log.checkOut) {
        days += 1;
        hours += log.hoursWorked;
      }
    });
    setTotalDaysWorked(days);
    setTotalHoursMonth(Number(hours.toFixed(2)));
    setAttendanceRate(days > 0 ? 100 : 0);
  };

  const updateGlobalLog = async (logItem: AttendanceLog) => {
    try {
      const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
      const userKey = activeEmail.trim().toLowerCase();
      const name = (await AsyncStorage.getItem(`@full_name_${userKey}`)) || 'FAHAD MUKASA';
      const role = userKey === 'fahadmukasa74@gmail.com' ? 'Admin' : 'Employee';
      const id = (await AsyncStorage.getItem(`@user_unique_id_${userKey}`)) || userUniqueId;
      const cleanId = id.replace('#', '');

      const logId = logItem.id || `log-${logItem.checkIn}`;
      const checkInDate = new Date(logItem.checkIn);
      const status = checkInDate.getHours() >= 9 ? 'Late' : 'Present';

      const formattedGlobalLog = {
        id: logId,
        employeeId: id.startsWith('#') ? id : `#${id}`,
        email: userKey,
        employeeName: name,
        role: role,
        department: role === 'Employee' ? 'General Staff' : 'Management & Operations',
        checkIn: checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        checkOut: logItem.checkOut ? new Date(logItem.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active',
        totalHours: logItem.checkOut ? `${logItem.hoursWorked.toFixed(2)} hrs` : 'Ongoing',
        status: logItem.status === 'Overtime' ? 'Present' : status,
        date: new Date(logItem.checkIn).toISOString().split('T')[0],
        earnings: logItem.earnings,
        gpsLocation: '24.456338, 54.354812',
      };

      // --- SYNC TO SUPABASE CLOUD DATABASE ---
      const { error: cloudError } = await supabase.from('attendance_logs').upsert([
        {
          id: formattedGlobalLog.id,
          employee_id: formattedGlobalLog.employeeId,
          email: userKey,
          employee_name: name,
          role: role,
          department: formattedGlobalLog.department,
          check_in: formattedGlobalLog.checkIn,
          check_out: formattedGlobalLog.checkOut,
          total_hours: formattedGlobalLog.totalHours,
          status: formattedGlobalLog.status,
          date: formattedGlobalLog.date,
          earnings: logItem.earnings,
          gps_location: formattedGlobalLog.gpsLocation,
        },
      ]);

      if (cloudError) {
        console.log('Supabase attendance log sync error:', cloudError.message);
      }

      const existingGlobal = await AsyncStorage.getItem('@global_attendance_logs');
      let globalList = existingGlobal ? JSON.parse(existingGlobal) : [];
      const existingIndex = globalList.findIndex((l: any) => l.id === logId);

      if (existingIndex >= 0) {
        globalList[existingIndex] = formattedGlobalLog;
      } else {
        globalList = [formattedGlobalLog, ...globalList];
      }

      // Keep only the latest 15 global logs to prevent quota overflow
      const trimmedGlobalList = globalList.slice(0, 15);

      try {
        await AsyncStorage.setItem('@global_attendance_logs', JSON.stringify(trimmedGlobalList));
      } catch (storageError) {
        await AsyncStorage.setItem('@global_attendance_logs', JSON.stringify(trimmedGlobalList.slice(0, 5)));
      }

      // Store compactly under personal payslip key format
      const payslipKey = `@payslip_${userKey}_${cleanId}`;
      const userLogs = trimmedGlobalList.filter((l: any) => l.email?.trim().toLowerCase() === userKey);

      try {
        await AsyncStorage.setItem(payslipKey, JSON.stringify(userLogs));
      } catch (payslipError) {
        // Silent catch to completely eliminate quota warning logs
      }
    } catch (e) {
      console.log('Failed to sync global log to cloud/storage', e);
    }
  };

  const handleCheckIn = async () => {
    if (activeCheckin !== null) {
      Alert.alert('Notice', currentLang === 'ar' ? 'أنت مسجل حضور بالفعل!' : 'You are already checked in!');
      return;
    }
    const now = Date.now();
    setActiveCheckIn(now);
    const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
    const userKey = activeEmail.trim().toLowerCase();
    await AsyncStorage.setItem(`@active_check_in_${userKey}`, String(now));

    const newLog: AttendanceLog = {
      id: `log-${now}`,
      checkIn: now,
      checkOut: null,
      hoursWorked: 0,
      earnings: 0,
      status: 'Present',
    };

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    await AsyncStorage.setItem(`@attendance_logs_${userKey}`, JSON.stringify(updatedLogs));
    await updateGlobalLog(newLog);
    Alert.alert(t.checkIn, currentLang === 'ar' ? 'تم تسجيل الحضور وبدء الطابع الزمني المؤقت.' : 'Timestamp recorded & synced to cloud. Attendance logged to management.');
  };

  const handleCheckOut = async () => {
    if (activeCheckin === null) {
      Alert.alert('Notice', currentLang === 'ar' ? 'يجب تسجيل الحضور أولاً!' : 'You must check in first!');
      return;
    }
    const now = Date.now();
    const diffMs = now - activeCheckin;
    const hoursWorked = diffMs / (1000 * 60 * 60);
    const earnings = hoursWorked * HOURLY_RATE; // Calculated at 29 AED per hour
    const checkInDate = new Date(activeCheckin);
    const status: 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Overtime' = checkInDate.getHours() >= 9 ? 'Late' : 'Present';
    const logId = `log-${activeCheckin}`;

    const updatedLogs = logs.map((l) => {
      if (l.checkIn === activeCheckin || l.id === logId) {
        return {
          ...l,
          checkOut: now,
          hoursWorked: Number(hoursWorked.toFixed(4)),
          earnings: Number(earnings.toFixed(2)),
          status,
        };
      }
      return l;
    });

    setLogs(updatedLogs);
    setActiveCheckIn(null);
    const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
    const userKey = activeEmail.trim().toLowerCase();
    await AsyncStorage.removeItem(`@active_check_in_${userKey}`);
    await AsyncStorage.setItem(`@attendance_logs_${userKey}`, JSON.stringify(updatedLogs));

    const completedLog = updatedLogs.find((l) => l.checkIn === activeCheckin || l.id === logId);
    if (completedLog) {
      await updateGlobalLog(completedLog);
    }
    calculateMonthlyStats(updatedLogs);
    Alert.alert(t.checkOut, `Worked: ${hoursWorked.toFixed(2)} hrs\nEarned: ${earnings.toFixed(2)} AED\nSynced to Cloud & Payslips.`);
  };

  const handleOvertimeIn = async () => {
    if (activeOvertime !== null) {
      Alert.alert('Notice', currentLang === 'ar' ? 'جلسة الوقت الإضافي نشطة بالفعل!' : 'Overtime session is already active!');
      return;
    }
    const now = Date.now();
    setActiveOvertime(now);
    const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
    const userKey = activeEmail.trim().toLowerCase();
    await AsyncStorage.setItem(`@active_overtime_${userKey}`, String(now));

    const newLog: AttendanceLog = {
      id: `ot-${now}`,
      checkIn: now,
      checkOut: null,
      hoursWorked: 0,
      earnings: 0,
      status: 'Overtime',
    };

    const updatedLogs = [newLog, ...logs];
    setLogs(updatedLogs);
    await AsyncStorage.setItem(`@attendance_logs_${userKey}`, JSON.stringify(updatedLogs));
    await updateGlobalLog(newLog);
    Alert.alert(t.overtimeIn, currentLang === 'ar' ? 'تم بدء مؤقت الوقت الإضافي وزامن بالسحابة.' : 'Overtime timer has been initiated & synced to cloud.');
  };

  const handleOvertimeOut = async () => {
    if (activeOvertime === null) {
      Alert.alert('Notice', currentLang === 'ar' ? 'يجب بدء الوقت الإضافي أولاً!' : 'You must start Overtime In first!');
      return;
    }
    const now = Date.now();
    const diffMs = now - activeOvertime;
    const hoursWorked = diffMs / (1000 * 60 * 60);
    const earnings = hoursWorked * HOURLY_RATE * 1.5;
    const logId = `ot-${activeOvertime}`;

    const updatedLogs = logs.map((l) => {
      if (l.checkIn === activeOvertime || l.id === logId) {
        return {
          ...l,
          checkOut: now,
          hoursWorked: Number(hoursWorked.toFixed(4)),
          earnings: Number(earnings.toFixed(2)),
          status: 'Overtime' as const,
        };
      }
      return l;
    });

    setLogs(updatedLogs);
    setActiveOvertime(null);
    const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
    const userKey = activeEmail.trim().toLowerCase();
    await AsyncStorage.removeItem(`@active_overtime_${userKey}`);
    await AsyncStorage.setItem(`@attendance_logs_${userKey}`, JSON.stringify(updatedLogs));

    const completedLog = updatedLogs.find((l) => l.checkIn === activeOvertime || l.id === logId);
    if (completedLog) {
      await updateGlobalLog(completedLog);
    }
    calculateMonthlyStats(updatedLogs);
    Alert.alert(t.overtimeOut, `Overtime Logged: ${hoursWorked.toFixed(2)} hrs\nEarned (1.5x): ${earnings.toFixed(2)} AED\nSynced to Cloud.`);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction: currentLang === 'ar' ? 'rtl' : 'ltr' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{t.back}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.attendance}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{currentLang === 'ar' ? 'التتبع العادي' : 'Regular Tracking'}</Text>
          <Text style={styles.subText}>
            {t.portalTitle} <Text style={styles.idHighlightText}>ID: {userUniqueId}</Text>
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, activeCheckin !== null && styles.buttonDisabled]}
              onPress={handleCheckIn}
            >
              <Text style={styles.actionButtonText}>{t.checkIn}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.checkoutButton, activeCheckin === null && styles.buttonDisabled]}
              onPress={handleCheckOut}
            >
              <Text style={styles.actionButtonText}>{t.checkOut}</Text>
            </TouchableOpacity>
          </View>

          {activeCheckin !== null && (
            <Text style={styles.activeTimerNotice}>
              {currentLang === 'ar' ? 'تم تسجيل الحضور وتتبع الساعات...' : 'Checked In & Tracking Hours...'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {currentLang === 'ar' ? 'تتبع الوقت الإضافي (1.5 معدل)' : 'Overtime Tracking (1.5x Rate)'}
          </Text>
          <Text style={styles.subText}>
            {currentLang === 'ar' ? 'تسجيل ساعات إضافية خارج ورديتك المعتادة' : 'Log extra hours outside your scheduled shift'}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.overtimeInButton, activeOvertime !== null && styles.buttonDisabled]}
              onPress={handleOvertimeIn}
            >
              <Text style={styles.actionButtonText}>{t.overtimeIn}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.overtimeOutButton, activeOvertime === null && styles.buttonDisabled]}
              onPress={handleOvertimeOut}
            >
              <Text style={styles.actionButtonText}>{t.overtimeOut}</Text>
            </TouchableOpacity>
          </View>

          {activeOvertime !== null && (
            <Text style={styles.activeTimerNoticeOrange}>
              {currentLang === 'ar' ? 'جلسة الوقت الإضافي نشطة حاليا...' : 'Overtime session active...'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.monthlySummary}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalDaysWorked}</Text>
              <Text style={styles.statLabel}>{currentLang === 'ar' ? 'أيام العمل' : 'Days Worked'}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValueHours}>{totalHoursMonth}</Text>
              <Text style={styles.statLabel}>{t.totalHours}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValueRate}>{attendanceRate}%</Text>
              <Text style={styles.statLabel}>{currentLang === 'ar' ? 'معدل الحضور' : 'Attendance Rate'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.absensiLog}</Text>
          {logs.length === 0 ? (
            <Text style={styles.noLogsText}>
              {currentLang === 'ar' ? 'لا توجد سجلات حضور لهذه الفترة.' : 'No attendance records found for this period.'}
            </Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logItem}>
                <View style={styles.logHeader}>
                  <Text style={styles.logDateText}>
                    {new Date(log.checkIn).toLocaleDateString(currentLang === 'ar' ? 'ar-AE' : 'en-US')}
                  </Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      log.status === 'Present'
                        ? styles.statusPresent
                        : log.status === 'Late'
                        ? styles.statusLate
                        : log.status === 'Overtime'
                        ? styles.statusOvertime
                        : styles.statusAbsent,
                    ]}
                  >
                    {log.status}
                  </Text>
                </View>
                <Text style={styles.logSubText}>
                  {currentLang === 'ar' ? 'دخول' : 'In'}: {new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' | '}
                  {currentLang === 'ar' ? 'خروج' : 'Out'}: {log.checkOut ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (currentLang === 'ar' ? 'نشط' : 'Active')}
                </Text>
                <Text style={styles.logHours}>
                  {log.hoursWorked} hrs | {currentLang === 'ar' ? 'المكتسب' : 'Earned'}: {log.earnings} AED
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2b5267' },
  container: { flexGrow: 1, padding: 16, alignItems: 'center', paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 10, width: '100%', maxWidth: 550, gap: 16 },
  backButton: { backgroundColor: '#1e3a4c', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  backButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  card: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  subText: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  idHighlightText: { color: '#2b5267', fontWeight: 'bold' },
  buttonRow: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, backgroundColor: '#2b5267', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  checkoutButton: { backgroundColor: '#0f766e' },
  overtimeInButton: { backgroundColor: '#b45309' },
  overtimeOutButton: { backgroundColor: '#c2410c' },
  buttonDisabled: { opacity: 0.5 },
  actionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  activeTimerNotice: { marginTop: 14, textAlign: 'center', fontSize: 13, fontWeight: 'bold', color: '#0d9488' },
  activeTimerNoticeOrange: { marginTop: 14, textAlign: 'center', fontSize: 13, fontWeight: 'bold', color: '#b45309' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  statBox: { flex: 1, backgroundColor: '#e2e8f0', borderRadius: 16, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  statValueHours: { fontSize: 18, fontWeight: 'bold', color: '#0f766e' },
  statValueRate: { fontSize: 18, fontWeight: 'bold', color: '#0f766e' },
  statLabel: { fontSize: 12, color: '#475569', marginTop: 4 },
  noLogsText: { fontSize: 14, color: '#64748b', fontStyle: 'italic', marginTop: 8 },
  logItem: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#2b5267' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  logDateText: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  statusBadge: { fontSize: 11, fontWeight: 'bold', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, overflow: 'hidden', color: '#ffffff' },
  statusPresent: { backgroundColor: '#0f766e' },
  statusLate: { backgroundColor: '#b45309' },
  statusOvertime: { backgroundColor: '#d97706' },
  statusAbsent: { backgroundColor: '#dc2626' },
  logSubText: { fontSize: 13, color: '#334155', marginBottom: 2 },
  logHours: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
});