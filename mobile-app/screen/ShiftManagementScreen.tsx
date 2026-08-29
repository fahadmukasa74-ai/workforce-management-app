import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  I18nManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  role: 'Employee' | 'Manager' | 'Supervisor' | 'Admin';
  shiftDate: string;
  startTime: string;
  endTime: string;
  totalHours: string;
  department: string;
  status: 'Scheduled' | 'Completed' | 'Missed' | 'Swapped';
  location?: string;
}

interface RegisteredWorker {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
  status?: string;
}

interface ShiftManagementScreenProps {
  onBack: () => void;
  onOpenAttendanceLogs: () => void;
  onOpenEmployeeOverview: () => void;
  onNavigateToShiftScreen?: (mode: string, adminId: string) => void;
  userRole?: string;
  currentAdminId?: string;
  currentTheme?: 'Dark' | 'Light';
  onThemeChange?: (theme: 'Dark' | 'Light') => void;
  currentFontSize?: 'Small' | 'Medium' | 'Large';
  onFontSizeChange?: (size: 'Small' | 'Medium' | 'Large') => void;
  globalTextStyle?: { fontSize: number; lineHeight: number };
}

export default function ShiftManagementScreen({
  onBack,
  onOpenAttendanceLogs,
  onOpenEmployeeOverview,
  onNavigateToShiftScreen,
  userRole = 'Admin',
  currentAdminId = '#1945',
  currentTheme = 'Dark',
  onThemeChange,
  currentFontSize = 'Medium',
  onFontSizeChange,
  globalTextStyle,
}: ShiftManagementScreenProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [registeredWorkers, setRegisteredWorkers] = useState<RegisteredWorker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [portalLang, setPortalLang] = useState<'en' | 'ar'>('en');

  // Assign New Shift Modal States
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedWorkerEmail, setSelectedWorkerEmail] = useState('');
  const [selectedShiftType, setSelectedShiftType] = useState<'Morning' | 'Evening'>('Morning');
  const [shiftDate, setShiftDate] = useState('2026-08-20');
  const [shiftLocation, setShiftLocation] = useState('Propaganda Restaurant Al Bateen Park Plaza');

  // Edit Shift Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDepartment, setEditDepartment] = useState('');

  // Swap Shift Modal States
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swappingShift, setSwappingShift] = useState<Shift | null>(null);
  const [selectedSwapWorkerEmail, setSelectedSwapWorkerEmail] = useState('');

  // Theme & Font Scale States
  const [themeMode, setThemeMode] = useState<'Dark' | 'Light'>(currentTheme);
  const [fontSizeSetting, setFontSizeSetting] = useState<'Small' | 'Medium' | 'Large'>(currentFontSize);

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
    loadPreferencesAndRoster();
    const interval = setInterval(loadRoster, 3000);
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

  const loadPreferencesAndRoster = async () => {
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
      console.log('Failed to load portal language or theme preference', error);
    }
    loadRoster();
  };

  const loadRoster = async () => {
    try {
      const savedWorkers = await AsyncStorage.getItem('@registered_workers_list');
      let activeWorkers: RegisteredWorker[] = [];
      if (savedWorkers) {
        const parsedWorkers: RegisteredWorker[] = JSON.parse(savedWorkers);
        activeWorkers = parsedWorkers.filter((w) => !w.status || w.status.toLowerCase() === 'active');
        setRegisteredWorkers(activeWorkers);
      } else {
        activeWorkers = [
          { id: '#1945', fullName: 'FAHAD MUKASA', email: 'fahadmukasa74@gmail.com', role: 'Admin', department: 'Restaurant Operations', status: 'Active' },
          { id: '#7940', fullName: 'OMEGA 256', email: 'omega256@gmail.com', role: 'Employee', department: 'Restaurant Operations', status: 'Active' }
        ];
        setRegisteredWorkers(activeWorkers);
      }

      // --- FETCH SHIFTS FROM SUPABASE CLOUD ---
      let currentShifts: Shift[] = [];
      const { data: cloudShifts, error: cloudError } = await supabase
        .from('shifts')
        .select('*');

      if (!cloudError && cloudShifts && cloudShifts.length > 0) {
        currentShifts = cloudShifts.map((cs: any) => ({
          id: cs.id,
          employeeId: cs.employee_id || cs.employeeId || '#1945',
          employeeName: cs.employee_name || cs.employeeName || 'Staff Member',
          employeeEmail: cs.employee_email || cs.employeeEmail || '',
          role: cs.role || 'Employee',
          shiftDate: cs.shift_date || cs.shiftDate || '2026-08-20',
          startTime: cs.start_time || cs.startTime || '07:00 AM',
          endTime: cs.end_time || cs.endTime || '05:00 PM',
          totalHours: cs.total_hours || cs.totalHours || '10.0 hrs',
          department: cs.department || 'Restaurant Operations',
          status: cs.status || 'Scheduled',
          location: cs.location || 'Propaganda Restaurant Al Bateen Park Plaza',
        }));
      } else {
        const savedGlobalRosters = await AsyncStorage.getItem('@global_shift_rosters');
        if (savedGlobalRosters) {
          currentShifts = JSON.parse(savedGlobalRosters);
        }
      }

      const existingEmails = new Set(currentShifts.map((s) => s.employeeEmail?.trim().toLowerCase()));
      let updated = [...currentShifts];

      activeWorkers.forEach((w, index) => {
        const email = w.email.trim().toLowerCase();
        if (!existingEmails.has(email)) {
          updated.push({
            id: `shift-${Date.now()}-${index}`,
            employeeId: w.id || '#1945',
            employeeName: w.fullName || 'Staff Member',
            employeeEmail: w.email,
            role: (w.role as any) || 'Employee',
            shiftDate: '2026-08-20',
            startTime: '07:00 AM',
            endTime: '05:00 PM',
            totalHours: '10.0 hrs',
            department: w.department || 'Restaurant Operations',
            status: 'Scheduled',
            location: 'Propaganda Restaurant Al Bateen Park Plaza',
          });
        }
      });

      setShifts(updated);
      await AsyncStorage.setItem('@global_shift_rosters', JSON.stringify(updated));
    } catch (error) {
      console.log('Failed to load shift management data from cloud/storage', error);
    }
  };

  const saveShiftsToStorage = async (updatedShifts: Shift[]) => {
    setShifts(updatedShifts);
    try {
      await AsyncStorage.setItem('@global_shift_rosters', JSON.stringify(updatedShifts));
      await AsyncStorage.setItem('@management_shifts', JSON.stringify(updatedShifts));

      for (const shift of updatedShifts) {
        if (shift.employeeEmail && shift.employeeId) {
          const cleanEmail = shift.employeeEmail.trim().toLowerCase();
          const cleanId = shift.employeeId.replace('#', '');
          const specificKey = `@shift_roster_${cleanEmail}_${cleanId}`;

          const userShifts = updatedShifts
            .filter((s) => s.employeeEmail?.trim().toLowerCase() === cleanEmail)
            .map((s) => ({
              id: s.id,
              date: s.shiftDate,
              time: `${s.startTime} - ${s.endTime}`,
              location: s.location || 'Propaganda Restaurant Al Bateen Park Plaza',
              status: s.status === 'Swapped' ? 'Swap Requested' : 'Assigned',
            }));
          await AsyncStorage.setItem(specificKey, JSON.stringify(userShifts));
        }

        // --- SYNC EACH SHIFT TO SUPABASE CLOUD ---
        await supabase.from('shifts').upsert([
          {
            id: shift.id,
            employee_id: shift.employeeId,
            employee_name: shift.employeeName,
            employee_email: shift.employeeEmail,
            role: shift.role,
            shift_date: shift.shiftDate,
            start_time: shift.startTime,
            end_time: shift.endTime,
            total_hours: shift.totalHours,
            department: shift.department,
            status: shift.status,
            location: shift.location,
          },
        ], { onConflict: 'id' });
      }
    } catch (error) {
      console.log('Failed to save shifts to cloud/storage', error);
    }
  };

  const handleOpenAssignForm = () => {
    if (userRole !== 'Admin') {
      Alert.alert(isRTL ? 'الوصول مقيد' : 'Access Restricted', isRTL ? 'فقط المستخدمون بصفتهم مشرف يمكنهم تعيين مناوبات جديدة.' : 'Only users with Admin role can assign new shifts.');
      return;
    }
    setAssignModalVisible(true);
  };

  const handleSaveNewShift = () => {
    if (!selectedWorkerEmail) {
      Alert.alert(isRTL ? 'خطأ في التحقق' : 'Validation Error', isRTL ? 'الرجاء اختيار موظف للمناوبة.' : 'Please select an employee for the shift.');
      return;
    }

    const worker = registeredWorkers.find((w) => w.email === selectedWorkerEmail);
    if (!worker) return;

    const startTime = selectedShiftType === 'Morning' ? '07:00 AM' : '02:00 PM';
    const endTime = selectedShiftType === 'Morning' ? '05:00 PM' : '12:00 AM';

    const newShift: Shift = {
      id: `shift-${Date.now()}`,
      employeeId: worker.id || '#1945',
      employeeName: worker.fullName || 'Staff Member',
      employeeEmail: worker.email,
      role: (worker.role as any) || 'Employee',
      shiftDate: shiftDate.trim() || '2026-08-20',
      startTime,
      endTime,
      totalHours: '10.0 hrs',
      department: worker.department || 'Restaurant Operations',
      status: 'Scheduled',
      location: shiftLocation.trim() || 'Propaganda Restaurant Al Bateen Park Plaza',
    };

    const updated = [newShift, ...shifts];
    saveShiftsToStorage(updated);
    setAssignModalVisible(false);
    Alert.alert(isRTL ? 'نجاح' : 'Success', isRTL ? `تم تعيين مناوبة ${selectedShiftType} لـ ${worker.fullName} بنجاح.` : `New ${selectedShiftType} shift assigned to ${worker.fullName} successfully.`);
  };

  const confirmDeleteShift = (id: string, email: string) => {
    Alert.alert(
      isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      isRTL ? 'هل أنت متأكد أنك تريد إزالة هذه المناوبة؟' : 'Are you sure you want to remove this shift?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isRTL ? 'حذف' : 'Delete', style: 'destructive', onPress: () => deleteShift(id, email) }
      ]
    );
  };

  const deleteShift = async (id: string, email: string) => {
    try {
      const cleanEmail = email ? email.trim().toLowerCase() : '';
      const targetShift = shifts.find(s => s.id === id);
      const cleanId = targetShift ? targetShift.employeeId.replace('#', '') : '';

      if (cleanEmail && cleanId) {
        const key = `@shift_roster_${cleanEmail}_${cleanId}`;
        await AsyncStorage.removeItem(key);
      }

      // --- DELETE FROM SUPABASE CLOUD ---
      await supabase.from('shifts').delete().eq('id', id);

      const updated = shifts.filter((s) => s.id !== id);
      await saveShiftsToStorage(updated);

      Alert.alert(isRTL ? 'تم حذف المناوبة' : 'Shift Deleted', isRTL ? 'تمت إزالة المناوبة بنجاح.' : 'The shift has been successfully removed.');
      loadRoster();
    } catch (error) {
      console.log('Error deleting shift:', error);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'تعذر حذف المناوبة. يرجى المحاولة مرة أخرى.' : 'Unable to delete shift. Please try again.');
    }
  };

  const handleOpenEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setEditDate(shift.shiftDate);
    setEditStartTime(shift.startTime);
    setEditEndTime(shift.endTime);
    setEditDepartment(shift.department);
    setEditModalVisible(true);
  };

  const handleSaveEditedShift = () => {
    if (!editingShift) return;

    const updatedShifts = shifts.map((s) =>
      s.id === editingShift.id
        ? {
            ...s,
            shiftDate: editDate.trim() || s.shiftDate,
            startTime: editStartTime.trim() || s.startTime,
            endTime: editEndTime.trim() || s.endTime,
            department: editDepartment.trim() || s.department,
          }
        : s
    );

    saveShiftsToStorage(updatedShifts);
    setEditModalVisible(false);
    setEditingShift(null);
    Alert.alert(isRTL ? 'نجاح' : 'Success', isRTL ? 'تم تحديث تفاصيل المناوبة بنجاح.' : 'Shift details updated successfully.');
  };

  const handleOpenSwapModal = (shift: Shift) => {
    setSwappingShift(shift);
    setSelectedSwapWorkerEmail('');
    setSwapModalVisible(true);
  };

  const handleConfirmSwap = async () => {
    if (!swappingShift || !selectedSwapWorkerEmail) {
      Alert.alert(isRTL ? 'خطأ في التحقق' : 'Validation Error', isRTL ? 'الرجاء اختيار موظف لتبديل المناوبة معه.' : 'Please select an employee to swap shifts with.');
      return;
    }

    const targetWorker = registeredWorkers.find((w) => w.email === selectedSwapWorkerEmail);
    if (!targetWorker) return;

    const updatedShifts = shifts.map((s) => {
      if (s.id === swappingShift.id) {
        return {
          ...s,
          employeeId: targetWorker.id || '#1945',
          employeeName: targetWorker.fullName || 'Staff Member',
          employeeEmail: targetWorker.email,
          role: (targetWorker.role as any) || 'Employee',
          department: targetWorker.department || s.department,
          status: 'Swapped' as const,
        };
      }
      return s;
    });

    await saveShiftsToStorage(updatedShifts);
    setSwapModalVisible(false);
    setSwappingShift(null);
    Alert.alert(isRTL ? 'تم تبديل المناوبة' : 'Shift Swapped', isRTL ? 'تم تبديل المناوبة بنجاح بين الموظفين.' : 'The shift has been successfully exchanged between employees.');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Scheduled': return styles.statusScheduled;
      case 'Completed': return styles.statusCompleted;
      case 'Missed': return styles.statusMissed;
      case 'Swapped': return styles.statusSwapped;
      default: return styles.statusScheduled;
    }
  };

  const filteredShifts = shifts.filter((shift) => {
    const matchesSearch =
      shift.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shift.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shift.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shift.shiftDate.includes(searchQuery);
    const matchesStatus = selectedStatusFilter === 'All' || shift.status === selectedStatusFilter;
    const matchesDept = selectedDeptFilter === 'All' || shift.department === selectedDeptFilter;
    return matchesSearch && matchesStatus && matchesDept;
  });

  const isDesktop = windowWidth > 900;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isLight ? '#f1f5f9' : '#2b5267', direction: isRTL ? 'rtl' : 'ltr' } as any]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Row */}
        <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]} onPress={onBack}>
            <Text style={[styles.backButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>← {isRTL ? 'العودة إلى لوحة التحكم' : 'Back to Dashboard'}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'إدارة المناوبات والجداول' : 'Shift Management & Rosters'}
          </Text>
        </View>

        {/* Integration Quick Links Bar */}
        <View style={[styles.quickLinksCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.quickLinksTitle, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'مصفوفة الربط المرجعي' : 'Cross-Reference Matrix'}
          </Text>
          <View style={[styles.quickLinksRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenAttendanceLogs}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'عرض سجلات الحضور' : 'View Attendance Logs'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenEmployeeOverview}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'نظرة عامة على الموظفين' : 'Employee Overview'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search & Filter Controls */}
        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <View style={[styles.searchHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.sectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'جدول مناوبات الموظفين' : 'Employee Shifts Roster'}
            </Text>
            {userRole === 'Admin' && (
              <TouchableOpacity style={styles.assignHeaderBtn} onPress={handleOpenAssignForm}>
                <Text style={[styles.assignHeaderBtnText, activeTextStyle]}>{isRTL ? '+ تعيين مناوبة جديدة' : '+ Assign New Shift'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TextInput
            style={[styles.searchInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }, isRTL && { textAlign: 'right' }]}
            placeholder={isRTL ? 'البحث برقم المعرف أو الاسم أو القسم أو التاريخ...' : 'Search by ID, name, department, or date...'}
            placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'تصفية حسب الحالة:' : 'Status Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Scheduled', 'Completed', 'Missed', 'Swapped'].map((status) => (
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
              {isRTL ? 'تصفية حسب القسم:' : 'Department Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Engineering & AI', 'Service Department', 'Operations', 'Restaurant Operations'].map((dept) => (
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

        {/* Shift Cards Grid */}
        <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop, isRTL && { flexDirection: 'row-reverse' }]}>
          {filteredShifts.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
              <Text style={[styles.emptyText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'لم يتم العثور على مناوبات تطابق معايير التصفية الخاصة بك.' : 'No shifts found matching your filter criteria.'}
              </Text>
            </View>
          ) : (
            filteredShifts.map((shift) => (
              <View key={shift.id} style={[styles.shiftCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.shiftCardDesktop]}>
                <View style={[styles.shiftCardTop, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text style={[styles.employeeName, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                      {shift.employeeName} - <Text style={styles.idHighlightText}>ID: {shift.employeeId}</Text>
                    </Text>
                    <Text style={[styles.roleText, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>{shift.role} • {shift.department}</Text>
                  </View>
                  <View style={[styles.statusBadge, getStatusColor(shift.status)]}>
                    <Text style={[styles.statusText, activeTextStyle]}>{shift.status}</Text>
                  </View>
                </View>

                <View style={[styles.scheduleBox, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                  <Text style={[styles.dateLabel, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>Date: {shift.shiftDate}</Text>
                  <View style={[styles.timeRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.timeText, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>Start: {shift.startTime}</Text>
                    <Text style={[styles.timeText, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>End: {shift.endTime}</Text>
                  </View>
                  <Text style={[styles.hoursText, activeTextStyle, isRTL && { textAlign: 'right' }]}>Total Duration: {shift.totalHours}</Text>
                  {shift.location && <Text style={[styles.locationText, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>{shift.location}</Text>}
                  <Text style={[styles.syncedLabel, activeTextStyle, isRTL && { textAlign: 'right' }]}>Synced with Supabase Cloud</Text>
                </View>

                <View style={[styles.actionsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <TouchableOpacity
                    style={[styles.actionBtnEdit, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c', borderColor: isLight ? '#94a3b8' : '#2b5267' }]}
                    onPress={() => handleOpenEditModal(shift)}
                  >
                    <Text style={[styles.actionBtnText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'تعديل' : 'Edit'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnSwap}
                    onPress={() => handleOpenSwapModal(shift)}
                  >
                    <Text style={[styles.actionBtnText, activeTextStyle]}>{isRTL ? 'تبديل' : 'Swap'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtnDelete}
                    onPress={() => confirmDeleteShift(shift.id, shift.employeeEmail || '')}
                  >
                    <Text style={[styles.actionBtnText, activeTextStyle]}>{isRTL ? 'حذف' : 'Delete'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Assign New Shift Modal */}
      <Modal animationType="slide" transparent={true} visible={assignModalVisible} onRequestClose={() => setAssignModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تعيين مناوبة جديدة' : 'Assign New Shift'}
              </Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setAssignModalVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.menuScroll}>
              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'اختر الموظف' : 'Select Employee'}
              </Text>
              {registeredWorkers.map((worker) => (
                <TouchableOpacity
                  key={worker.email}
                  style={[
                    styles.workerSelectItem,
                    { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' },
                    selectedWorkerEmail === worker.email && styles.workerSelectItemActive,
                  ]}
                  onPress={() => setSelectedWorkerEmail(worker.email)}
                >
                  <Text style={[styles.workerSelectText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                    {worker.fullName} ({worker.id}) — {worker.role}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'اختر نوع المناوبة' : 'Choose Shift Type'}
              </Text>
              <View style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
                {['Morning', 'Evening'].map((typeItem) => (
                  <TouchableOpacity
                    key={typeItem}
                    style={[styles.pill, { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c' }, selectedShiftType === typeItem && styles.pillActive]}
                    onPress={() => setSelectedShiftType(typeItem as any)}
                  >
                    <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedShiftType === typeItem && styles.pillTextActive]}>
                      {typeItem === 'Morning' ? (isRTL ? 'صباحي (7 ص – 5 م)' : 'Morning (7 AM – 5 PM)') : (isRTL ? 'مسائي (2 م – 12 ص)' : 'Evening (2 PM – 12 AM)')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تاريخ المناوبة (YYYY-MM-DD)' : 'Shift Date (YYYY-MM-DD)'}
              </Text>
              <TextInput
                style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                value={shiftDate}
                onChangeText={setShiftDate}
                placeholder="2026-08-20"
                placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
              />

              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'الموقع' : 'Location'}
              </Text>
              <TextInput
                style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                value={shiftLocation}
                onChangeText={setShiftLocation}
                placeholder="Propaganda Restaurant Al Bateen Park Plaza"
                placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
              />
            </ScrollView>
            <TouchableOpacity style={styles.submitWorkerBtn} onPress={handleSaveNewShift}>
              <Text style={[styles.submitWorkerBtnText, activeTextStyle]}>{isRTL ? 'حفظ وتعيين المناوبة' : 'Save & Assign Shift'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Shift Modal */}
      <Modal animationType="slide" transparent={true} visible={editModalVisible} onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تعديل تفاصيل المناوبة' : 'Edit Shift Details'}
              </Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setEditModalVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.menuScroll}>
              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تاريخ المناوبة (YYYY-MM-DD)' : 'Shift Date (YYYY-MM-DD)'}
              </Text>
              <TextInput
                style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                value={editDate}
                onChangeText={setEditDate}
                placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
              />

              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'وقت البدء' : 'Start Time'}
              </Text>
              <TextInput
                style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                value={editStartTime}
                onChangeText={setEditStartTime}
                placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
              />

              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'وقت الانتهاء' : 'End Time'}
              </Text>
              <TextInput
                style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                value={editEndTime}
                onChangeText={setEditEndTime}
                placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
              />

              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'القسم' : 'Department'}
              </Text>
              <TextInput
                style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                value={editDepartment}
                onChangeText={setEditDepartment}
                placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
              />
            </ScrollView>
            <TouchableOpacity style={styles.submitWorkerBtn} onPress={handleSaveEditedShift}>
              <Text style={[styles.submitWorkerBtnText, activeTextStyle]}>{isRTL ? 'حفظ التغييرات' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Swap Shift Modal */}
      <Modal animationType="slide" transparent={true} visible={swapModalVisible} onRequestClose={() => setSwapModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تبديل المناوبة مع موظف' : 'Swap Shift with Employee'}
              </Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setSwapModalVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.menuScroll}>
              <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'اختر موظف متاح للتبديل معه' : 'Select Available Employee to Swap With'}
              </Text>
              {registeredWorkers
                .filter((w) => w.email !== swappingShift?.employeeEmail)
                .map((worker) => (
                  <TouchableOpacity
                    key={worker.email}
                    style={[
                      styles.workerSelectItem,
                      { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' },
                      selectedSwapWorkerEmail === worker.email && styles.workerSelectItemActive,
                    ]}
                    onPress={() => setSelectedSwapWorkerEmail(worker.email)}
                  >
                    <Text style={[styles.workerSelectText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                      {worker.fullName} ({worker.id}) — {worker.department}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity style={styles.submitWorkerBtn} onPress={handleConfirmSwap}>
              <Text style={[styles.submitWorkerBtnText, activeTextStyle]}>{isRTL ? 'تأكيد تبديل المناوبة' : 'Confirm Shift Swap'}</Text>
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
  quickLinksCard: { borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1 },
  quickLinksTitle: { fontWeight: 'bold', marginBottom: 10 },
  quickLinksRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  quickLinkBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  quickLinkText: { fontWeight: 'bold' },
  card: { width: '100%', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1 },
  searchHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 },
  sectionTitle: { fontWeight: 'bold' },
  assignHeaderBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  assignHeaderBtnText: { color: '#ffffff', fontWeight: 'bold' },
  searchInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, marginBottom: 16 },
  filterSection: { marginBottom: 10 },
  filterLabel: { fontWeight: 'bold', marginBottom: 6 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16 },
  pillActive: { backgroundColor: '#2563eb' },
  pillText: { fontWeight: '500' },
  pillTextActive: { color: '#ffffff', fontWeight: 'bold' },
  gridContainer: { width: '100%', gap: 16 },
  gridContainerDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCard: { width: '100%', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1 },
  emptyText: { fontStyle: 'italic' },
  shiftCard: { width: '100%', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  shiftCardDesktop: { width: '48%', minWidth: 400, flexGrow: 1 },
  shiftCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  employeeName: { fontWeight: 'bold', marginBottom: 2 },
  idHighlightText: { color: '#f59e0b', fontWeight: 'bold' },
  roleText: {},
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  statusScheduled: { backgroundColor: '#1e40af' },
  statusCompleted: { backgroundColor: '#065f46' },
  statusMissed: { backgroundColor: '#991b1b' },
  statusSwapped: { backgroundColor: '#78350f' },
  statusText: { color: '#ffffff', fontWeight: 'bold' },
  scheduleBox: { padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1 },
  dateLabel: { fontWeight: 'bold', marginBottom: 6 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  timeText: {},
  hoursText: { fontWeight: 'bold', color: '#f59e0b' },
  locationText: { marginTop: 4 },
  syncedLabel: { color: '#34d399', fontStyle: 'italic', marginTop: 6 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtnEdit: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  actionBtnSwap: { flex: 1, backgroundColor: '#78350f', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnDelete: { flex: 1, backgroundColor: '#7f1d1d', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#ffffff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 520, maxHeight: '85%', borderRadius: 24, padding: 24, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 16, marginBottom: 12 },
  modalTitle: { fontWeight: 'bold' },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeIconText: { fontWeight: 'bold' },
  menuScroll: { marginVertical: 4, maxHeight: 420 },
  inputLabel: { fontWeight: 'bold', marginBottom: 8, marginTop: 12 },
  workerSelectItem: { padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1 },
  workerSelectItemActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  workerSelectText: { fontWeight: 'bold' },
  textInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  submitWorkerBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitWorkerBtnText: { color: '#ffffff', fontWeight: 'bold' },
});