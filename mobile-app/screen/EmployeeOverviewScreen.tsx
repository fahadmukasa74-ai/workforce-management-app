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
  Alert,
  Modal,
  Dimensions,
  I18nManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

interface EmployeeOverviewScreenProps {
  onBack: () => void;
  onViewProfile: (employeeId: string, employeeEmail?: string) => void;
  onDeleteEmployee?: (employeeId: string, employeeEmail?: string) => void;
  onOpenAttendanceLogs?: () => void;
  onOpenLeaveManagement?: () => void;
  onOpenPayslipManagement?: () => void;
  currentTheme?: 'Dark' | 'Light';
  onThemeChange?: (theme: 'Dark' | 'Light') => void;
  currentFontSize?: 'Small' | 'Medium' | 'Large';
  onFontSizeChange?: (size: 'Small' | 'Medium' | 'Large') => void;
  globalTextStyle?: { fontSize: number; lineHeight: number };
}

interface Employee {
  id: string;
  fullName?: string;
  name?: string;
  email: string;
  role: 'Employee' | 'Manager' | 'Supervisor' | 'Admin';
  department?: string;
  status?: 'Active' | 'On Leave' | 'Inactive';
  joinDate?: string;
  profileImage?: string | null;
  phone?: string;
}

export default function EmployeeOverviewScreen({
  onBack,
  onViewProfile,
  onDeleteEmployee,
  onOpenAttendanceLogs,
  onOpenLeaveManagement,
  onOpenPayslipManagement,
  currentTheme = 'Dark',
  onThemeChange,
  currentFontSize = 'Medium',
  onFontSizeChange,
  globalTextStyle,
}: EmployeeOverviewScreenProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('All');
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [adminUniqueId, setAdminUniqueId] = useState('#1945');
  const [portalLang, setPortalLang] = useState<'en' | 'ar'>('en');

  // Messaging Modal States
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [activeMessageEmp, setActiveMessageEmp] = useState<Employee | null>(null);
  const [adminMessageText, setAdminMessageText] = useState('');

  // Theme & Font Scale States
  const [themeMode, setThemeMode] = useState<'Dark' | 'Light'>(currentTheme);
  const [fontSizeSetting, setFontSizeSetting] = useState<'Small' | 'Medium' | 'Large'>(currentFontSize);

  const isRTL = portalLang === 'ar';
  const isLight = themeMode === 'Light';

  const scale = fontSizeSetting === 'Small' ? 12 : fontSizeSetting === 'Medium' ? 16 : 20;
  const activeTextStyle = globalTextStyle || {
    fontSize: scale,
    lineHeight: scale + 4,
  };

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    loadPreferencesAndEmployees();
    const interval = setInterval(loadStoredEmployees, 3000);
    return () => {
      subscription?.remove();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (currentTheme) setThemeMode(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (currentFontSize) setFontSizeSetting(currentFontSize);
  }, [currentFontSize]);

  const loadPreferencesAndEmployees = async () => {
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
    loadStoredEmployees();
  };

  const loadStoredEmployees = async () => {
    try {
      const savedAdminId = await AsyncStorage.getItem('@user_unique_id_fahadmukasa74@gmail.com');
      if (savedAdminId) {
        setAdminUniqueId(savedAdminId);
      }

      // --- FETCH FROM SUPABASE CLOUD DATABASE ---
      let parsedWorkers: Employee[] = [];
      const { data: cloudWorkers, error: cloudError } = await supabase.from('workers').select('*');

      if (!cloudError && cloudWorkers && cloudWorkers.length > 0) {
        parsedWorkers = cloudWorkers.map((w: any) => ({
          id: w.id || '#1945',
          fullName: w.full_name || w.fullName || 'Staff Member',
          name: w.full_name || w.fullName || 'Staff Member',
          email: w.email || '',
          role: w.role || 'Employee',
          department: w.department || 'Restaurant Operations',
          status: w.status || 'Active',
          joinDate: w.join_date || '2026-08-01',
          profileImage: w.profile_image || null,
          phone: w.phone || '+971 50 000 0000',
        }));
      } else {
        // Fallback to local storage if offline or error occurs
        const savedWorkersJson = await AsyncStorage.getItem('@registered_workers_list');
        if (savedWorkersJson) {
          parsedWorkers = JSON.parse(savedWorkersJson);
        }
      }

      if (parsedWorkers.length > 0) {
        const seenIds = new Set<string>();
        const sanitizedWorkers = parsedWorkers.map((w) => {
          let currentId = w.id || '#1945';
          if (w.role === 'Admin' || w.email?.trim().toLowerCase() === 'fahadmukasa74@gmail.com') {
            currentId = '#1945';
          }
          if (seenIds.has(currentId) && currentId !== '#1945') {
            while (seenIds.has(currentId) || currentId === '#1945') {
              const randomNum = Math.floor(1945 + Math.random() * 7291);
              currentId = `#${randomNum}`;
            }
          }
          seenIds.add(currentId);
          return { ...w, id: currentId };
        });

        const updatedWorkers = await Promise.all(
          sanitizedWorkers.map(async (w) => {
            const userKey = w.email ? w.email.trim().toLowerCase() : '';
            const cleanId = w.id.replace('#', '');
            const profileKey = `@employee_profile_${userKey}_${cleanId}`;

            const savedProfileJson = await AsyncStorage.getItem(profileKey);
            let resolvedImage = w.profileImage || null;
            let resolvedName = w.fullName || w.name || 'Staff Member';
            let resolvedStatus: 'Active' | 'On Leave' | 'Inactive' = w.status || 'Active';

            if (savedProfileJson) {
              const parsedProfile = JSON.parse(savedProfileJson);
              if (parsedProfile.profileImage) resolvedImage = parsedProfile.profileImage;
              if (parsedProfile.fullName) resolvedName = parsedProfile.fullName;
              if (parsedProfile.status) resolvedStatus = parsedProfile.status;
            } else {
              const isAdminWorker = w.role === 'Admin' || userKey === 'fahadmukasa74@gmail.com' || w.id === '#1945';
              if (isAdminWorker) {
                resolvedImage = await AsyncStorage.getItem('@profile_image_fahadmukasa74@gmail.com');
              } else if (userKey && w.id) {
                resolvedImage = await AsyncStorage.getItem(`@profile_image_${userKey}_${cleanId}`);
              }
            }

            if (userKey && w.id) {
              await AsyncStorage.setItem(`@user_unique_id_${userKey}`, w.id);
            }

            return {
              ...w,
              name: resolvedName,
              department: w.department || 'Restaurant Operations',
              status: resolvedStatus,
              joinDate: w.joinDate || '2026-08-01',
              profileImage: resolvedImage || w.profileImage || null,
            };
          })
        );
        setEmployees(updatedWorkers);
      }
    } catch (error) {
      console.log('Failed to load registered employee data from cloud/storage', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Admin': return '👑 ';
      case 'Manager': return '👔 ';
      case 'Supervisor': return '📋 ';
      default: return '👤 ';
    }
  };

  const handleDeactivate = (id: string, name: string, currentStatus?: 'Active' | 'On Leave' | 'Inactive') => {
    const nextStatus: 'Active' | 'Inactive' = currentStatus === 'Active' ? 'Inactive' : 'Active';
    Alert.alert(
      isRTL ? 'تأكيد الإجراء' : 'Confirm Action',
      isRTL ? `تغيير الحالة لـ ${name}؟` : `Change status for ${name}?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'تأكيد' : 'Confirm',
          onPress: async () => {
            const updated = employees.map((emp) =>
              emp.id === id ? { ...emp, status: nextStatus } : emp
            );
            setEmployees(updated);
            await AsyncStorage.setItem('@registered_workers_list', JSON.stringify(updated));

            const targetEmp = employees.find((e) => e.id === id);
            if (targetEmp && targetEmp.email) {
              const userKey = targetEmp.email.trim().toLowerCase();
              const cleanId = id.replace('#', '');
              
              // Sync status update to Supabase cloud
              await supabase.from('workers').update({ status: nextStatus }).eq('email', userKey);

              const profileKey = `@employee_profile_${userKey}_${cleanId}`;
              const savedProf = await AsyncStorage.getItem(profileKey);
              if (savedProf) {
                const parsed = JSON.parse(savedProf);
                parsed.status = nextStatus;
                await AsyncStorage.setItem(profileKey, JSON.stringify(parsed));
              }
            }
          },
        },
      ]
    );
  };

  const handleDeleteEmployee = (id: string, email: string, name: string) => {
    Alert.alert(
      isRTL ? 'تأكيد الحذف' : 'Confirm Deletion',
      isRTL ? `هل أنت متأكد أنك تريد حذف ${name} (${id}) نهائياً؟` : `Are you sure you want to delete employee ${name} (${id})?`,
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. Filter out target employee from state
              const updatedWorkers = employees.filter((emp) => emp.id !== id);
              setEmployees(updatedWorkers);

              // 2. Immediately update AsyncStorage list
              await AsyncStorage.setItem('@registered_workers_list', JSON.stringify(updatedWorkers));

              // 3. Delete from Supabase cloud database
              if (email) {
                await supabase.from('workers').delete().eq('email', email.trim().toLowerCase());
              }

              // 4. Clear user-specific storage keys
              if (email) {
                const cleanEmail = email.trim().toLowerCase();
                const cleanId = id.replace('#', '');
                await AsyncStorage.multiRemove([
                  `@role_${cleanEmail}`,
                  `@email_${cleanEmail}`,
                  `@password_${cleanEmail}`,
                  `@full_name_${cleanEmail}`,
                  `@user_unique_id_${cleanEmail}`,
                  `@profile_image_${cleanEmail}_${cleanId}`,
                  `@employee_profile_${cleanEmail}_${cleanId}`,
                ]);
              }

              // 5. Trigger parent dashboard deletion handler if provided
              if (onDeleteEmployee) {
                onDeleteEmployee(id, email);
              }

              Alert.alert(isRTL ? 'نجاح' : 'Success', isRTL ? 'تم حذف الموظف بنجاح.' : 'Employee deleted successfully.');
            } catch (error) {
              console.log('Failed to delete employee:', error);
              Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل حذف الموظف.' : 'Could not delete employee.');
            }
          },
        },
      ]
    );
  };

  const handleSendMessage = async () => {
    if (!activeMessageEmp || !adminMessageText.trim()) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'الرجاء إدخال رسالة قبل الإرسال.' : 'Please enter a message before sending.');
      return;
    }
    try {
      const userKey = activeMessageEmp.email.trim().toLowerCase();
      const cleanId = activeMessageEmp.id.replace('#', '');
      const msgKey = `@employee_message_${userKey}_${cleanId}`;

      const newMessage = {
        id: `msg-${Date.now()}`,
        sender: 'Admin',
        recipient: activeMessageEmp.email,
        recipientId: activeMessageEmp.id,
        timestamp: new Date().toISOString(),
        subject: 'Secure Corporate Notification',
        body: adminMessageText.trim(),
        text: adminMessageText.trim(),
        status: 'Unread',
      };

      const existingMsgsJson = await AsyncStorage.getItem(msgKey);
      const msgsList = existingMsgsJson ? JSON.parse(existingMsgsJson) : [];
      msgsList.push(newMessage);
      await AsyncStorage.setItem(msgKey, JSON.stringify(msgsList));

      const globalKey = '@all_corporate_messages';
      const globalJson = await AsyncStorage.getItem(globalKey);
      const globalList = globalJson ? JSON.parse(globalJson) : [];
      globalList.push(newMessage);
      await AsyncStorage.setItem(globalKey, JSON.stringify(globalList));

      const displayName = activeMessageEmp.name || activeMessageEmp.fullName || 'Employee';
      Alert.alert(isRTL ? 'تم إرسال الرسالة' : 'Message Sent', isRTL ? `تم إرسال الإشعار إلى ${displayName}.` : `Notification sent to ${displayName}.`);
      setAdminMessageText('');
      setActiveMessageEmp(null);
      setMessageModalVisible(false);
    } catch (error) {
      console.log('Failed to send message', error);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إرسال الرسالة.' : 'Failed to send message.');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const empName = emp.name || emp.fullName || '';
    const matchesSearch =
      empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.includes(searchQuery);
    const matchesRole = selectedRoleFilter === 'All' || emp.role === selectedRoleFilter;
    const matchesStatus = selectedStatusFilter === 'All' || emp.status === selectedStatusFilter;
    const matchesDept = selectedDeptFilter === 'All' || emp.department === selectedDeptFilter;
    return matchesSearch && matchesRole && matchesStatus && matchesDept;
  });

  const isDesktop = windowWidth > 900;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isLight ? '#f1f5f9' : '#2b5267', direction: isRTL ? 'rtl' : 'ltr' } as any]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]} onPress={onBack} activeOpacity={0.7}>
            <Text style={[styles.backButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
              ← {isRTL ? 'العودة إلى لوحة التحكم' : 'Back to Dashboard'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'نظرة عامة على الموظفين' : 'Employee Overview'}
          </Text>
        </View>

        <View style={[styles.quickLinksCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.quickLinksTitle, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'مصفوفة الربط المرجعي' : 'Cross-Reference Matrix'} <Text style={styles.idHighlightText}>{isRTL ? `رقم المشرف: ${adminUniqueId}` : `Admin ID: ${adminUniqueId}`}</Text>
          </Text>
          <View style={[styles.quickLinksRow, isRTL && { flexDirection: 'row-reverse' }]}>
            {onOpenAttendanceLogs && (
              <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenAttendanceLogs} activeOpacity={0.7}>
                <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'سجلات الحضور' : 'Attendance Logs'}</Text>
              </TouchableOpacity>
            )}
            {onOpenLeaveManagement && (
              <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenLeaveManagement} activeOpacity={0.7}>
                <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'طلبات الإجازات' : 'Leave Requests'}</Text>
              </TouchableOpacity>
            )}
            {onOpenPayslipManagement && (
              <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenPayslipManagement} activeOpacity={0.7}>
                <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'مراجعة قسائم الرواتب' : 'Payslip Review'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.sectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'البحث وتصفية الموظفين' : 'Search & Filter Staff'}
          </Text>
          <TextInput
            style={[styles.searchInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }, isRTL && { textAlign: 'right' }]}
            placeholder={isRTL ? 'البحث برقم المعرف أو الاسم أو البريد الإلكتروني...' : 'Search by ID, name, or email...'}
            placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{isRTL ? 'تصفية حسب الدور:' : 'Role Filter:'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Employee', 'Manager', 'Supervisor', 'Admin'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.pill,
                    { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c', borderColor: isLight ? '#cbd5e1' : '#2b5267' },
                    selectedRoleFilter === role && styles.pillActive,
                  ]}
                  onPress={() => setSelectedRoleFilter(role)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedRoleFilter === role && styles.pillTextActive]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{isRTL ? 'تصفية حسب الحالة:' : 'Status Filter:'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Active', 'On Leave', 'Inactive'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.pill,
                    { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c', borderColor: isLight ? '#cbd5e1' : '#2b5267' },
                    selectedStatusFilter === status && styles.pillActive,
                  ]}
                  onPress={() => setSelectedStatusFilter(status)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedStatusFilter === status && styles.pillTextActive]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{isRTL ? 'تصفية حسب القسم:' : 'Department Filter:'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Engineering & AI', 'Service Department', 'Operations', 'Restaurant Operations', 'General Staff'].map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[
                    styles.pill,
                    { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c', borderColor: isLight ? '#cbd5e1' : '#2b5267' },
                    selectedDeptFilter === dept && styles.pillActive,
                  ]}
                  onPress={() => setSelectedDeptFilter(dept)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedDeptFilter === dept && styles.pillTextActive]}>
                    {dept}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop, isRTL && { flexDirection: 'row-reverse' }]}>
          {filteredEmployees.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
              <Text style={[styles.emptyText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'لم يتم العثور على موظفين مطابخ لمعايير البحث الخاصة بك.' : 'No employees found matching your criteria.'}
              </Text>
            </View>
          ) : (
            filteredEmployees.map((emp) => {
              const displayName = emp.name || emp.fullName || 'Staff Member';
              return (
                <View key={emp.id} style={[styles.employeeCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.employeeCardDesktop]}>
                  <View style={[styles.empCardTop, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={styles.avatarContainer}>
                      {emp.profileImage ? (
                        <Image source={{ uri: emp.profileImage }} style={styles.avatarImage} />
                      ) : (
                        <View style={[styles.avatarCircle, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]}>
                          <Text style={[styles.avatarInitial, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{displayName.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        emp.status === 'Active' && styles.statusActive,
                        emp.status === 'On Leave' && styles.statusLeave,
                        emp.status === 'Inactive' && styles.statusInactive,
                      ]}
                    >
                      <Text style={[styles.statusText, activeTextStyle]}>{emp.status || 'Active'}</Text>
                    </View>
                  </View>
                  <Text style={[styles.empName, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                    {displayName}
                  </Text>
                  <Text style={[styles.idHighlightText, activeTextStyle, isRTL && { textAlign: 'right' }]}>ID: {emp.id}</Text>
                  <Text style={[styles.empEmail, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{emp.email}</Text>
                  <Text style={[styles.empPhone, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{emp.phone || '+971 50 000 0000'}</Text>
                  <View style={[styles.badgeRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={[styles.roleBadge, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                      <Text style={[styles.roleBadgeText, activeTextStyle]}>
                        {getRoleIcon(emp.role)}{emp.role}
                      </Text>
                    </View>
                    <Text style={[styles.deptText, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>{emp.department || 'General Staff'}</Text>
                  </View>
                  <Text style={[styles.joinDateText, activeTextStyle, { color: isLight ? '#64748b' : '#64748b' }, isRTL && { textAlign: 'right' }]}>
                    {isRTL ? `تاريخ الانضمام: ${emp.joinDate || '2026-08-01'}` : `Joined: ${emp.joinDate || '2026-08-01'}`}
                  </Text>

                  {/* Action Buttons Row */}
                  <View style={[styles.actionsRow, { borderTopColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
                    <TouchableOpacity
                      style={styles.actionBtnPrimary}
                      onPress={() => {
                        const cleanId = emp.id.replace('#', '');
                        onViewProfile(cleanId, emp.email);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionBtnPrimaryText, activeTextStyle]}>{isRTL ? 'عرض' : 'View'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtnSecondary, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]}
                      onPress={() => {
                        const cleanId = emp.id.replace('#', '');
                        onViewProfile(cleanId, emp.email);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionBtnSecondaryText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'تعديل' : 'Edit'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnMessage}
                      onPress={() => {
                        setActiveMessageEmp(emp);
                        setMessageModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionBtnMessageText, activeTextStyle]}>{isRTL ? 'رسالة' : 'Msg'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDanger}
                      onPress={() => handleDeactivate(emp.id, displayName, emp.status)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionBtnDangerText, activeTextStyle]}>
                        {emp.status === 'Active' ? (isRTL ? 'تعطيل' : 'Deactivate') : (isRTL ? 'تنشيط' : 'Activate')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDeleteEmployee(emp.id, emp.email, displayName)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.actionBtnDeleteText, activeTextStyle]}>{isRTL ? 'حذف' : 'Delete'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Admin Message Modal */}
      <Modal animationType="slide" transparent={true} visible={messageModalVisible} onRequestClose={() => setMessageModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? `إرسال رسالة إلى ${activeMessageEmp?.name || activeMessageEmp?.fullName || 'الموظف'}` : `Send Message to ${activeMessageEmp?.name || activeMessageEmp?.fullName || 'Employee'}`}
              </Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setMessageModalVisible(false)} activeOpacity={0.7}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={[styles.modalInputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'إشعار الشركة الآمن:' : 'Secure Corporate Notification:'}
              </Text>
              <TextInput
                style={[styles.modalTextInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                placeholder={isRTL ? 'اكتب رسالتك هنا...' : 'Type your message here...'}
                placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
                multiline={true}
                numberOfLines={4}
                value={adminMessageText}
                onChangeText={setAdminMessageText}
              />
              <TouchableOpacity style={styles.submitMsgBtn} onPress={handleSendMessage} activeOpacity={0.7}>
                <Text style={[styles.submitMsgBtnText, activeTextStyle]}>{isRTL ? 'إرسال الرسالة' : 'Send Message'}</Text>
              </TouchableOpacity>
            </View>
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
  idHighlightText: { color: '#f59e0b', fontWeight: 'bold' },
  card: { width: '100%', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12 },
  searchInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, marginBottom: 16 },
  filterSection: { marginBottom: 10 },
  filterLabel: { fontWeight: 'bold', marginBottom: 6 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1 },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontWeight: '500' },
  pillTextActive: { color: '#ffffff', fontWeight: 'bold' },
  gridContainer: { width: '100%', gap: 16 },
  gridContainerDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCard: { width: '100%', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1 },
  emptyText: { fontStyle: 'italic' },
  employeeCard: { width: '100%', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  employeeCardDesktop: { width: '48%', minWidth: 380, flexGrow: 1 },
  empCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  avatarContainer: {},
  avatarCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#f59e0b' },
  avatarInitial: { fontWeight: 'bold' },
  avatarImage: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: '#f59e0b' },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  statusActive: { backgroundColor: '#065f46' },
  statusLeave: { backgroundColor: '#78350f' },
  statusInactive: { backgroundColor: '#991b1b' },
  statusText: { color: '#ffffff', fontWeight: 'bold' },
  empName: { fontWeight: 'bold', marginBottom: 2 },
  empEmail: { marginBottom: 4 },
  empPhone: { marginBottom: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  roleBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  roleBadgeText: { color: '#38bdf8', fontWeight: 'bold' },
  deptText: { fontWeight: '500' },
  joinDateText: { fontStyle: 'italic', marginBottom: 16 },
  actionsRow: { flexDirection: 'row', gap: 6, borderTopWidth: 1, paddingTop: 14, flexWrap: 'wrap', zIndex: 2, elevation: 2 },
  actionBtnPrimary: { flex: 1, minWidth: 50, backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center', zIndex: 3, elevation: 3 },
  actionBtnPrimaryText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  actionBtnSecondary: { flex: 1, minWidth: 50, paddingVertical: 10, borderRadius: 8, alignItems: 'center', zIndex: 3, elevation: 3 },
  actionBtnSecondaryText: { fontWeight: 'bold', fontSize: 12 },
  actionBtnMessage: { flex: 1, minWidth: 50, backgroundColor: '#065f46', paddingVertical: 10, borderRadius: 8, alignItems: 'center', zIndex: 3, elevation: 3 },
  actionBtnMessageText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  actionBtnDanger: { flex: 1.2, minWidth: 70, backgroundColor: '#b45309', paddingVertical: 10, borderRadius: 8, alignItems: 'center', zIndex: 3, elevation: 3 },
  actionBtnDangerText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  actionBtnDelete: { flex: 1, minWidth: 55, backgroundColor: '#991b1b', paddingVertical: 10, borderRadius: 8, alignItems: 'center', zIndex: 3, elevation: 3 },
  actionBtnDeleteText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 480, borderRadius: 24, padding: 24, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16 },
  modalTitle: { fontWeight: 'bold', flex: 1, marginRight: 10 },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeIconText: { fontWeight: 'bold' },
  modalBody: {},
  modalInputLabel: { fontWeight: 'bold', marginBottom: 8 },
  modalTextInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, height: 120, textAlignVertical: 'top', marginBottom: 20 },
  submitMsgBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitMsgBtnText: { color: '#ffffff', fontWeight: 'bold' },
});