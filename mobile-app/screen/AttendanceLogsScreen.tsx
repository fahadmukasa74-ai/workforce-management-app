import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Image,
  Modal,
  Dimensions,
  I18nManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import enTranslations from '../lang/en.json';
import arTranslations from '../lang/ar.json';

const translationsMap = {
  en: enTranslations,
  ar: arTranslations,
};

interface AttendanceLog {
  id: string;
  employeeId: string;
  employeeName: string;
  role: 'Employee' | 'Manager' | 'Supervisor' | 'Admin';
  department: string;
  checkIn: string;
  checkOut: string;
  totalHours: string;
  status: 'Present' | 'Absent' | 'Late' | 'On Leave';
  date: string;
  gpsLocation?: string;
  profileImage?: string | null;
}

interface AttendanceLogsScreenProps {
  onBack: () => void;
  onViewEmployeeProfile: (employeeId: string) => void;
  onOpenAttendanceLogScreen?: (employeeId: string) => void;
  currentTheme?: 'Dark' | 'Light';
  onThemeChange?: (theme: 'Dark' | 'Light') => void;
  currentFontSize?: 'Small' | 'Medium' | 'Large';
  onFontSizeChange?: (size: 'Small' | 'Medium' | 'Large') => void;
  globalTextStyle?: { fontSize: number; lineHeight: number };
}

export default function AttendanceLogsScreen({
  onBack,
  onViewEmployeeProfile,
  onOpenAttendanceLogScreen,
  currentTheme = 'Dark',
  onThemeChange,
  currentFontSize = 'Medium',
  onFontSizeChange,
  globalTextStyle,
}: AttendanceLogsScreenProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('All');
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  // Appearance & Language state storage sync
  const [portalLang, setPortalLang] = useState<'en' | 'ar'>('en');

  // Employee History Modal States
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedEmployeeLogs, setSelectedEmployeeLogs] = useState<AttendanceLog[]>([]);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Theme & Font Scale States
  const [themeMode, setThemeMode] = useState<'Dark' | 'Light'>(currentTheme);
  const [fontSizeSetting, setFontSizeSetting] = useState<'Small' | 'Medium' | 'Large'>(currentFontSize);

  const t = translationsMap[portalLang] || translationsMap.en;
  const isRTL = portalLang === 'ar';
  const isLight = themeMode === 'Light';

  // Compute global dynamic text scaling if explicit prop isn't passed down
  const scale = fontSizeSetting === 'Small' ? 12 : fontSizeSetting === 'Medium' ? 16 : 20;
  const activeTextStyle = globalTextStyle || {
    fontSize: scale,
    lineHeight: scale + 4,
  };

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    loadPreferencesAndAttendance();
    const interval = setInterval(loadRealtimeAttendance, 3000);
    return () => {
      subscription?.remove();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (currentTheme) {
      setThemeMode(currentTheme);
    }
  }, [currentTheme]);

  useEffect(() => {
    if (currentFontSize) {
      setFontSizeSetting(currentFontSize);
    }
  }, [currentFontSize]);

  const loadPreferencesAndAttendance = async () => {
    try {
      const savedLang = await AsyncStorage.getItem('@portal_language');
      if (savedLang === 'Arabic' || savedLang === 'ar') {
        setPortalLang('ar');
        I18nManager.forceRTL(true);
        I18nManager.allowRTL(true);
      } else {
        setPortalLang('en');
        I18nManager.forceRTL(false);
        I18nManager.allowRTL(false);
      }

      const savedTheme = await AsyncStorage.getItem('@portal_theme');
      if (savedTheme === 'Dark' || savedTheme === 'Light') {
        setThemeMode(savedTheme as 'Dark' | 'Light');
        if (onThemeChange) onThemeChange(savedTheme as 'Dark' | 'Light');
      }

      const savedFont = await AsyncStorage.getItem('@portal_font_size');
      if (savedFont === 'Small' || savedFont === 'Medium' || savedFont === 'Large') {
        setFontSizeSetting(savedFont as 'Small' | 'Medium' | 'Large');
        if (onFontSizeChange) onFontSizeChange(savedFont as 'Small' | 'Medium' | 'Large');
      }
    } catch (error) {
      console.log('Failed to load portal preferences', error);
    }
    loadRealtimeAttendance();
  };

  const loadRealtimeAttendance = async () => {
    try {
      // --- FETCH ATTENDANCE LOGS FROM SUPABASE CLOUD DATABASE ---
      let existingLogs: AttendanceLog[] = [];
      const { data: cloudLogs, error: cloudError } = await supabase.from('attendance_logs').select('*');

      if (!cloudError && cloudLogs && cloudLogs.length > 0) {
        existingLogs = cloudLogs.map((l: any) => ({
          id: l.id || `log-${Date.now()}`,
          employeeId: l.employee_id || l.employeeId || '#1945',
          employeeName: l.employee_name || l.employeeName || 'Staff Member',
          role: l.role || 'Employee',
          department: l.department || 'Restaurant Operations',
          checkIn: l.check_in || l.checkIn || 'Not Checked In',
          checkOut: l.check_out || l.checkOut || 'Active',
          totalHours: l.total_hours || l.totalHours || '0.0 hrs',
          status: l.status || 'Present',
          date: l.date || new Date().toISOString().split('T')[0],
          gpsLocation: l.gps_location || l.gpsLocation || 'Al Bateen Hub (24.4564° N, 54.3548°E)',
        }));
      } else {
        // Fallback to local storage if offline or error occurs
        const savedGlobal = await AsyncStorage.getItem('@global_attendance_logs');
        existingLogs = savedGlobal ? JSON.parse(savedGlobal) : [];
      }

      const savedWorkersJson = await AsyncStorage.getItem('@registered_workers_list');

      if (savedWorkersJson) {
        const registeredWorkers = JSON.parse(savedWorkersJson);
        const unifiedLogsMap = new Map<string, AttendanceLog[]>();

        existingLogs.forEach((log) => {
          const eId = (log.employeeId || '#1945').trim();
          if (!unifiedLogsMap.has(eId)) {
            unifiedLogsMap.set(eId, []);
          }
          unifiedLogsMap.get(eId)?.push(log);
        });

        const finalProcessedLogs: AttendanceLog[] = [];

        for (const worker of registeredWorkers) {
          const workerId = worker.id || '#1945';
          const workerName = worker.fullName || worker.name || 'Staff Member';
          const userKey = worker.email ? worker.email.trim().toLowerCase() : '';
          const isAdminWorker = worker.role === 'Admin' || userKey === 'fahadmukasa74@gmail.com' || workerId === '#1945';

          let specificImage = null;
          if (isAdminWorker) {
            specificImage = await AsyncStorage.getItem('@profile_image_fahadmukasa74@gmail.com');
          } else if (userKey && workerId) {
            const cleanId = workerId.replace('#', '');
            specificImage = await AsyncStorage.getItem(`@profile_image_${userKey}_${cleanId}`);
          }

          const resolvedImage = specificImage || worker.profileImage || null;
          const workerLogs = unifiedLogsMap.get(workerId.trim()) || [];

          if (workerLogs.length === 0) {
            const defaultWorkerLog: AttendanceLog = {
              id: `default-${workerId}`,
              employeeId: workerId,
              employeeName: workerName,
              role: (worker.role as any) || 'Employee',
              department: worker.department || 'Restaurant Operations',
              checkIn: 'Not Checked In',
              checkOut: 'Active',
              totalHours: '0.0 hrs',
              status: 'Absent',
              date: new Date().toISOString().split('T')[0],
              gpsLocation: 'Al Bateen Hub (Pending Check-In)',
              profileImage: resolvedImage,
            };
            finalProcessedLogs.push(defaultWorkerLog);
          } else {
            workerLogs.forEach((l) => {
              finalProcessedLogs.push({
                ...l,
                employeeId: workerId,
                employeeName: workerName,
                role: (worker.role as any) || l.role || 'Employee',
                department: worker.department || l.department || 'Restaurant Operations',
                profileImage: resolvedImage,
              });
            });
          }
        }
        setLogs(finalProcessedLogs);
      } else {
        setLogs(existingLogs);
      }
    } catch (error) {
      console.log('Failed to load realtime logs from cloud/storage', error);
    }
  };

  const handleOpenLogHistory = (empId: string, empName: string) => {
    const cleanId = empId.trim();
    const filtered = logs.filter(
      (l) => l.employeeId.trim().toLowerCase() === cleanId.toLowerCase()
    );
    setSelectedEmployeeLogs(filtered);
    setSelectedEmployeeName(empName);
    setSelectedEmployeeId(cleanId);
    setHistoryModalVisible(true);
    if (onOpenAttendanceLogScreen) {
      onOpenAttendanceLogScreen(cleanId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Present': return styles.statusPresent;
      case 'Late': return styles.statusLate;
      case 'Absent': return styles.statusAbsent;
      case 'On Leave': return styles.statusLeave;
      default: return styles.statusPresent;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.employeeId.includes(searchQuery) ||
      log.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatusFilter === 'All' || log.status === selectedStatusFilter;
    const matchesDept = selectedDeptFilter === 'All' || log.department === selectedDeptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const isDesktop = windowWidth > 900;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isLight ? '#f1f5f9' : '#2b5267', direction: isRTL ? 'rtl' : 'ltr' } as any]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]} onPress={onBack}>
            <Text style={[styles.backButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>← {t.back || 'Back to Dashboard'}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {t.attendance || 'Attendance & GPS Logs'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.sectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {t.searchAndFilter || 'Search & Filter Records'}
          </Text>
          <TextInput
            style={[styles.searchInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }, isRTL && { textAlign: 'right' }]}
            placeholder={t.searchPlaceholder || 'Search by ID#, employee name, or department...'}
            placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {t.statusFilter || 'Status Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Present', 'Late', 'Absent', 'On Leave'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.pill, { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c' }, selectedStatusFilter === status && styles.pillActive]}
                  onPress={() => setSelectedStatusFilter(status)}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedStatusFilter === status && styles.pillTextActive]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {t.departmentFilter || 'Department Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Engineering & AI', 'Service Department', 'Operations', 'Management & Operations', 'General Staff', 'Restaurant Operations'].map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[styles.pill, { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c' }, selectedDeptFilter === dept && styles.pillActive]}
                  onPress={() => setSelectedDeptFilter(dept)}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedDeptFilter === dept && styles.pillTextActive]}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop]}>
          {filteredLogs.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
              <Text style={[styles.emptyText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {t.noAttendanceRecords || 'No attendance records found matching your filters.'}
              </Text>
            </View>
          ) : (
            filteredLogs.map((log) => (
              <View key={log.id} style={[styles.logCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.logCardDesktop]}>
                <View style={[styles.logCardTop, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[styles.employeeInfoRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    {log.profileImage ? (
                      <Image source={{ uri: log.profileImage }} style={styles.avatarImage} />
                    ) : (
                      <View style={[styles.avatarCircle, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]}>
                        <Text style={[styles.avatarInitial, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{log.employeeName.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, paddingHorizontal: 4 }}>
                      <TouchableOpacity onPress={() => onViewEmployeeProfile(log.employeeId.replace('#', ''))}>
                        <Text style={[styles.employeeNameLink, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>{log.employeeName}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.employeeMeta, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                        <Text style={styles.idHighlightText}>ID: {log.employeeId}</Text> • {log.role}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, getStatusColor(log.status)]}>
                    <Text style={[styles.statusText, activeTextStyle]}>{log.status}</Text>
                  </View>
                </View>

                <Text style={[styles.deptText, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>Department: {log.department}</Text>
                <Text style={[styles.dateText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>Date: {log.date}</Text>

                <View style={[styles.timeDetailsContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[styles.timeBox, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                    <Text style={[styles.timeLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }]}>{t.checkInLabel || 'Check-In'}</Text>
                    <Text style={[styles.timeValue, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{log.checkIn}</Text>
                  </View>
                  <View style={[styles.timeBox, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                    <Text style={[styles.timeLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }]}>{t.checkOutLabel || 'Check-Out'}</Text>
                    <Text style={[styles.timeValue, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{log.checkOut}</Text>
                  </View>
                  <View style={[styles.timeBox, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                    <Text style={[styles.timeLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }]}>{t.totalHoursLabel || 'Total Hours'}</Text>
                    <Text style={[styles.timeValue, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{log.totalHours}</Text>
                  </View>
                </View>

                <View style={[styles.gpsContainer, { backgroundColor: isLight ? '#f8fafc' : '#0f172a', borderColor: isLight ? '#cbd5e1' : '#1e3a4c' }]}>
                  <Text style={[styles.gpsLabel, activeTextStyle, { color: isLight ? '#475569' : '#64748b' }, isRTL && { textAlign: 'right' }]}>{t.gpsLocationLabel || 'GPS Location:'}</Text>
                  <Text style={[styles.gpsValue, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>{log.gpsLocation || 'Al Bateen Hub (24.4564° N, 54.3548°E)'}</Text>
                </View>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c', borderColor: isLight ? '#94a3b8' : '#2b5267' }]}
                  onPress={() => handleOpenLogHistory(log.employeeId, log.employeeName)}
                >
                  <Text style={[styles.actionButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{t.viewFullHistory || 'View Full History'}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Employee Full Attendance History Modal */}
      <Modal animationType="slide" transparent={true} visible={historyModalVisible} onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <View>
                <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{selectedEmployeeName}</Text>
                <Text style={[styles.modalSubtitle, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>Full Attendance History | ID: {selectedEmployeeId}</Text>
              </View>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setHistoryModalVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {selectedEmployeeLogs.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: isLight ? '#f8fafc' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
                  <Text style={[styles.emptyText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                    {t.noHistoricalLogs || 'No historical logs recorded for this employee yet.'}
                  </Text>
                </View>
              ) : (
                selectedEmployeeLogs.map((item, index) => (
                  <View key={item.id || index} style={[styles.historyItemCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                    <View style={[styles.logCardTop, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.historyDateText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>Date: {item.date}</Text>
                      <View style={[styles.statusBadge, getStatusColor(item.status)]}>
                        <Text style={[styles.statusText, activeTextStyle]}>{item.status}</Text>
                      </View>
                    </View>
                    <View style={[styles.timeDetailsContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                      <View style={[styles.timeBox, { backgroundColor: isLight ? '#ffffff' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                        <Text style={[styles.timeLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }]}>In</Text>
                        <Text style={[styles.timeValue, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{item.checkIn}</Text>
                      </View>
                      <View style={[styles.timeBox, { backgroundColor: isLight ? '#ffffff' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                        <Text style={[styles.timeLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }]}>Out</Text>
                        <Text style={[styles.timeValue, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{item.checkOut}</Text>
                      </View>
                      <View style={[styles.timeBox, { backgroundColor: isLight ? '#ffffff' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                        <Text style={[styles.timeLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }]}>Hours</Text>
                        <Text style={[styles.timeValue, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{item.totalHours}</Text>
                      </View>
                    </View>
                    <Text style={[styles.historyGpsText, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>{item.gpsLocation || 'Al Bateen Hub'}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity style={[styles.closeMenuButton, { backgroundColor: isLight ? '#2563eb' : '#2563eb' }]} onPress={() => setHistoryModalVisible(false)}>
              <Text style={[styles.closeMenuButtonText, activeTextStyle]}>{t.closeHistory || 'Close History'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flexGrow: 1, padding: 16, width: '100%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 16, flexWrap: 'wrap' },
  backButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  backButtonText: { fontWeight: 'bold' },
  headerTitle: { fontWeight: 'bold' },
  card: { width: '100%', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12 },
  searchInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, marginBottom: 16 },
  filterSection: { marginBottom: 10 },
  filterLabel: { fontWeight: 'bold', marginBottom: 6 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16 },
  pillActive: { backgroundColor: '#2563eb' },
  pillText: { fontWeight: '500' },
  pillTextActive: { color: '#ffffff', fontWeight: 'bold' },
  gridContainer: { width: '100%', gap: 16 },
  gridContainerDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCard: { width: '100%', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1 },
  emptyText: { fontStyle: 'italic' },
  logCard: { width: '100%', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  logCardDesktop: { width: '48%', minWidth: 420, flexGrow: 1 },
  logCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  employeeInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#f59e0b' },
  avatarInitial: { fontWeight: 'bold' },
  avatarImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#f59e0b' },
  employeeNameLink: { fontWeight: 'bold', marginBottom: 2 },
  employeeMeta: {},
  idHighlightText: { color: '#f59e0b', fontWeight: 'bold' },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  statusPresent: { backgroundColor: '#065f46' },
  statusLate: { backgroundColor: '#c2410c' },
  statusAbsent: { backgroundColor: '#991b1b' },
  statusLeave: { backgroundColor: '#78350f' },
  statusText: { color: '#ffffff', fontWeight: 'bold' },
  deptText: { marginBottom: 4 },
  dateText: { marginBottom: 14 },
  timeDetailsContainer: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  timeBox: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  timeLabel: { fontWeight: 'bold', marginBottom: 4 },
  timeValue: { fontWeight: 'bold' },
  gpsContainer: { padding: 10, borderRadius: 10, marginBottom: 16, borderWidth: 1 },
  gpsLabel: { fontWeight: 'bold', marginBottom: 2 },
  gpsValue: {},
  actionButton: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  actionButtonText: { fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 560, maxHeight: '85%', borderRadius: 24, padding: 24, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16 },
  modalTitle: { fontWeight: 'bold' },
  modalSubtitle: { marginTop: 2 },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeIconText: { fontWeight: 'bold' },
  modalScroll: { maxHeight: 420, marginBottom: 16 },
  historyItemCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  historyDateText: { fontWeight: 'bold' },
  historyGpsText: { marginTop: 4 },
  closeMenuButton: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeMenuButtonText: { color: '#ffffff', fontWeight: 'bold' },
});