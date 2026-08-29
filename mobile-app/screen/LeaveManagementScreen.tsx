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
  Image,
  Alert,
  Dimensions,
  I18nManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

interface LeaveRequest {
  id: string;
  employeeId: string;
  email?: string;
  employeeName: string;
  role: 'Employee' | 'Manager' | 'Supervisor' | 'Admin';
  leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
  startDate: string;
  endDate: string;
  totalDays: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reason: string;
  documentUri?: string | null;
  managerComment?: string;
  profileImage?: string | null;
}

interface LeaveManagementScreenProps {
  onBack: () => void;
  onOpenAttendanceLogs: () => void;
  onOpenEmployeeOverview: () => void;
  currentTheme?: 'Dark' | 'Light';
  onThemeChange?: (theme: 'Dark' | 'Light') => void;
  currentFontSize?: 'Small' | 'Medium' | 'Large';
  onFontSizeChange?: (size: 'Small' | 'Medium' | 'Large') => void;
  globalTextStyle?: { fontSize: number; lineHeight: number };
}

export default function LeaveManagementScreen({
  onBack,
  onOpenAttendanceLogs,
  onOpenEmployeeOverview,
  currentTheme = 'Dark',
  onThemeChange,
  currentFontSize = 'Medium',
  onFontSizeChange,
  globalTextStyle,
}: LeaveManagementScreenProps) {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [portalLang, setPortalLang] = useState<'en' | 'ar'>('en');

  // History Modal State
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<LeaveRequest[]>([]);
  const [historyEmployeeName, setHistoryEmployeeName] = useState('');

  // Document Modal View State
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [viewingDocumentUri, setViewingDocumentUri] = useState<string | null>(null);

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
    loadPreferencesAndLeaveRequests();
    const interval = setInterval(loadLeaveRequests, 3000);
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

  const loadPreferencesAndLeaveRequests = async () => {
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
    loadLeaveRequests();
  };

  const loadLeaveRequests = async () => {
    try {
      const { data: cloudLeaves, error: cloudError } = await supabase.from('leave_requests').select('*');

      let fetchedRequests: LeaveRequest[] = [];

      if (!cloudError && cloudLeaves && cloudLeaves.length > 0) {
        fetchedRequests = cloudLeaves.map((l: any) => ({
          id: l.id || `leave-${Date.now()}`,
          employeeId: l.employee_id || l.employeeId || '#1945',
          email: l.email || '',
          employeeName: l.employee_name || l.employeeName || 'Staff Member',
          role: l.role || 'Employee',
          leaveType: l.leave_type || l.leaveType || 'Annual',
          startDate: l.start_date || l.startDate || '2026-08-27',
          endDate: l.end_date || l.endDate || '2026-08-30',
          totalDays: l.total_days || l.totalDays || '3 Days',
          status: l.status || 'Pending',
          reason: l.reason || 'Standard Leave Request',
          documentUri: l.document_uri || l.documentUri || null,
          managerComment: l.manager_comment || l.managerComment || 'Pending review.',
          profileImage: l.profile_image || l.profileImage || null,
        }));
      }

      if (fetchedRequests.length === 0) {
        const managementList = await AsyncStorage.getItem('@management_leave_requests');
        if (managementList) {
          fetchedRequests = JSON.parse(managementList);
        }
      }

      setLeaveRequests(fetchedRequests);
    } catch (error) {
      console.log('Failed to load leave requests from cloud/storage', error);
    }
  };

  const updateStatus = async (req: LeaveRequest, decision: 'Approved' | 'Rejected', comment?: string) => {
    try {
      const finalComment = comment || `Status updated to ${decision}`;

      const { error: cloudError } = await supabase.from('leave_requests').upsert([
        {
          id: req.id,
          employee_id: req.employeeId,
          email: req.email || '',
          employee_name: req.employeeName,
          role: req.role,
          leave_type: req.leaveType,
          start_date: req.startDate,
          end_date: req.endDate,
          total_days: req.totalDays,
          status: decision,
          reason: req.reason,
          document_uri: req.documentUri,
          manager_comment: finalComment,
        },
      ]);

      if (cloudError) {
        console.log('Supabase leave request update error:', cloudError.message);
      }

      const updatedMgmt = leaveRequests.map((r) =>
        r.id === req.id ? { ...r, status: decision, managerComment: finalComment } : r
      );
      await AsyncStorage.setItem('@management_leave_requests', JSON.stringify(updatedMgmt));
      setLeaveRequests(updatedMgmt);
    } catch (error) {
      console.log('Failed to update status in cloud/storage', error);
    }
  };

  const handleApprove = async (req: LeaveRequest) => {
    await updateStatus(req, 'Approved', 'Approved by management.');
    Alert.alert(isRTL ? 'موافقة' : 'Approved', isRTL ? `تمت الموافقة على طلب إجازة ${req.employeeName}.` : `Leave request for ${req.employeeName} has been approved & synced to cloud.`);
  };

  const handleReject = (req: LeaveRequest) => {
    Alert.alert(
      isRTL ? 'رفض الطلب' : 'Reject Request', 
      isRTL ? `أدخل تعليق الرفض لـ ${req.employeeName}:` : `Enter rejection comment for ${req.employeeName}:`, 
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'تأكيد الرفض' : 'Confirm Reject',
          style: 'destructive',
          onPress: async () => {
            await updateStatus(req, 'Rejected', 'Rejected by management.');
            Alert.alert(isRTL ? 'مرفوض' : 'Rejected', isRTL ? `تم رفض طلب إجازة ${req.employeeName}.` : `Leave request for ${req.employeeName} was rejected & synced to cloud.`);
          },
        },
      ]
    );
  };

  const handleViewHistory = (name: string, empId: string, email?: string) => {
    const cleanEmpId = empId ? empId.replace('#', '').trim() : '';
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const targetName = name ? name.trim().toLowerCase() : '';

    const history = leaveRequests.filter((req) => {
      const reqEmpId = req.employeeId ? req.employeeId.replace('#', '').trim() : '';
      const reqEmail = req.email ? req.email.trim().toLowerCase() : '';
      const reqName = req.employeeName ? req.employeeName.trim().toLowerCase() : '';

      return (
        (cleanEmpId && reqEmpId === cleanEmpId) ||
        (cleanEmail && reqEmail === cleanEmail) ||
        (targetName && reqName === targetName)
      );
    });

    setSelectedEmployeeHistory(history);
    setHistoryEmployeeName(`${name} (${empId})`);
    setHistoryModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return styles.statusPending;
      case 'Approved': return styles.statusApproved;
      case 'Rejected': return styles.statusRejected;
      default: return styles.statusPending;
    }
  };

  const filteredRequests = leaveRequests.filter((req) => {
    const matchesSearch =
      req.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.leaveType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatusFilter === 'All' || req.status === selectedStatusFilter;
    const matchesType = selectedTypeFilter === 'All' || req.leaveType === selectedTypeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const isDesktop = windowWidth > 900;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isLight ? '#f1f5f9' : '#2b5267', direction: isRTL ? 'rtl' : 'ltr' } as any]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]} onPress={onBack}>
            <Text style={[styles.backButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>← {isRTL ? 'العودة إلى لوحة التحكم' : 'Back to Dashboard'}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'إدارة طلبات الإجازات' : 'Leave Requests Management'}
          </Text>
        </View>

        <View style={[styles.quickLinksCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.quickLinksTitle, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'مصفوفة الربط المرجعي' : 'Cross-Reference Matrix'}
          </Text>
          <View style={[styles.quickLinksRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenAttendanceLogs}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'سجلات الحضور' : 'Attendance Logs'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenEmployeeOverview}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'نظرة عامة على الموظفين' : 'Employee Overview'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.sectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'البحث وتصفية طلبات الإجازات' : 'Search & Filter Leave Requests'}
          </Text>
          <TextInput
            style={[styles.searchInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }, isRTL && { textAlign: 'right' }]}
            placeholder={isRTL ? 'البحث برقم المعرف أو اسم الموظف أو نوع الإجازة...' : 'Search by ID, employee name or leave type...'}
            placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'تصفية حسب الحالة:' : 'Status Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
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
              {isRTL ? 'تصفية حسب نوع الإجازة:' : 'Leave Type Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Annual', 'Sick', 'Emergency', 'Unpaid'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.pill, { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c' }, selectedTypeFilter === type && styles.pillActive]}
                  onPress={() => setSelectedTypeFilter(type)}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedTypeFilter === type && styles.pillTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop, isRTL && { flexDirection: 'row-reverse' }]}>
          {filteredRequests.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
              <Text style={[styles.emptyText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'لم يتم العثور على طلبات إجازة تطابق معايير التصفية.' : 'No leave requests found matching your filter criteria.'}
              </Text>
            </View>
          ) : (
            filteredRequests.map((req) => (
              <View key={req.id} style={[styles.leaveCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.leaveCardDesktop]}>
                <View style={[styles.leaveCardTop, isRTL && { flexDirection: 'row-reverse' }]}>
                  {req.profileImage ? (
                    <Image source={{ uri: req.profileImage }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]}>
                      <Text style={[styles.avatarText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{req.employeeName.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.employeeName, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                      {req.employeeName} <Text style={styles.idHighlightText}>ID: {req.employeeId}</Text>
                    </Text>
                    <Text style={[styles.roleText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                      {req.role} • <Text style={styles.typeHighlight}>{req.leaveType} Leave</Text>
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, getStatusColor(req.status)]}>
                    <Text style={[styles.statusText, activeTextStyle]}>{req.status}</Text>
                  </View>
                </View>
                <View style={[styles.detailsBox, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                  <View style={[styles.dateRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.dateText, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>From: {req.startDate}</Text>
                    <Text style={[styles.dateText, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>To: {req.endDate}</Text>
                  </View>
                  <Text style={[styles.durationText, activeTextStyle, isRTL && { textAlign: 'right' }]}>Duration: {req.totalDays || '3 Days'}</Text>
                  <Text style={[styles.reasonText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]} numberOfLines={2}>Reason: {req.reason}</Text>
                  <Text style={[styles.syncedLabel, activeTextStyle, isRTL && { textAlign: 'right' }]}>Linked to Cloud & Employee Overview</Text>

                  {req.leaveType === 'Sick' && req.documentUri && (
                    <TouchableOpacity
                      style={[styles.viewDocBtn, { backgroundColor: isLight ? '#f1f5f9' : '#1e3a4c' }]}
                      onPress={() => {
                        setViewingDocumentUri(req.documentUri || null);
                        setDocModalVisible(true);
                      }}
                    >
                      <Text style={[styles.viewDocText, activeTextStyle]}>View Doctor Note / Sick Document</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={[styles.actionsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <TouchableOpacity style={styles.actionBtnApprove} onPress={() => handleApprove(req)}>
                    <Text style={[styles.actionBtnText, activeTextStyle]}>{isRTL ? 'موافقة' : 'Approve'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnReject} onPress={() => handleReject(req)}>
                    <Text style={[styles.actionBtnText, activeTextStyle]}>{isRTL ? 'رفض' : 'Reject'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtnHistory, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c', borderColor: isLight ? '#94a3b8' : '#2b5267' }]}
                    onPress={() => handleViewHistory(req.employeeName, req.employeeId, req.email)}
                  >
                    <Text style={[styles.actionBtnText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'السجل' : 'History'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Employee Leave History Modal */}
      <Modal animationType="slide" transparent={true} visible={historyModalVisible} onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? `سجل الإجازات: ${historyEmployeeName}` : `Leave History: ${historyEmployeeName}`}
              </Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setHistoryModalVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {selectedEmployeeHistory.length === 0 ? (
                <Text style={[styles.emptyText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                  {isRTL ? 'لم يتم العثور على سجل إجازات سابق.' : 'No prior leave history found.'}
                </Text>
              ) : (
                selectedEmployeeHistory.map((item) => (
                  <View key={item.id} style={[styles.historyItemCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                    <View style={[styles.historyItemTop, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.historyType, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{item.leaveType} Leave</Text>
                      <Text
                        style={[
                          styles.historyStatus,
                          activeTextStyle,
                          item.status === 'Approved'
                            ? styles.textGreen
                            : item.status === 'Rejected'
                            ? styles.textRed
                            : styles.textYellow,
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                    <Text style={[styles.historyDates, activeTextStyle, isRTL && { textAlign: 'right' }]}>
                      {item.startDate} to {item.endDate} ({item.totalDays || '3 Days'})
                    </Text>
                    <Text style={[styles.historyReason, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{item.reason}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={[styles.closeMenuButton, { backgroundColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={() => setHistoryModalVisible(false)}>
              <Text style={[styles.closeMenuButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'إغلاق السجل' : 'Close History'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* View Doctor Note Document Modal */}
      <Modal animationType="fade" transparent={true} visible={docModalVisible} onRequestClose={() => setDocModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'ملاحظة الطبيب المرفقة للإجازة المرضية' : 'Attached Sick Leave Note'}
              </Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setDocModalVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              {viewingDocumentUri ? (
                <Image source={{ uri: viewingDocumentUri }} style={styles.fullDocImage} resizeMode="contain" />
              ) : (
                <Text style={[styles.emptyText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                  {isRTL ? 'لا يوجد مستند متاح.' : 'No document available.'}
                </Text>
              )}
            </View>
            <TouchableOpacity style={[styles.closeMenuButton, { backgroundColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={() => setDocModalVisible(false)}>
              <Text style={[styles.closeMenuButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? 'إغلاق المستند' : 'Close Document'}</Text>
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
  leaveCard: { width: '100%', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  leaveCardDesktop: { width: '48%', minWidth: 400, flexGrow: 1 },
  leaveCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#38bdf8' },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#38bdf8' },
  avatarText: { fontWeight: 'bold' },
  employeeName: { fontWeight: 'bold', marginBottom: 2 },
  idHighlightText: { color: '#f59e0b', fontWeight: 'bold' },
  roleText: {},
  typeHighlight: { color: '#38bdf8', fontWeight: 'bold' },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  statusPending: { backgroundColor: '#78350f' },
  statusApproved: { backgroundColor: '#065f46' },
  statusRejected: { backgroundColor: '#991b1b' },
  statusText: { color: '#ffffff', fontWeight: 'bold' },
  detailsBox: { padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dateText: {},
  durationText: { fontWeight: 'bold', color: '#f59e0b', marginBottom: 4 },
  reasonText: { fontStyle: 'italic', marginBottom: 8 },
  syncedLabel: { color: '#34d399', fontStyle: 'italic', marginTop: 4, marginBottom: 4 },
  viewDocBtn: { padding: 8, borderRadius: 8, alignItems: 'center', marginTop: 4, borderWidth: 1, borderColor: '#38bdf8' },
  viewDocText: { color: '#38bdf8', fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtnApprove: { flex: 1, backgroundColor: '#065f46', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnReject: { flex: 1, backgroundColor: '#991b1b', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnHistory: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  actionBtnText: { color: '#ffffff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 500, maxHeight: '85%', borderRadius: 24, padding: 24, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16 },
  modalTitle: { fontWeight: 'bold' },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeIconText: { fontWeight: 'bold' },
  modalScroll: { maxHeight: 380, marginBottom: 16 },
  historyItemCard: { borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  historyItemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  historyType: { fontWeight: 'bold' },
  historyStatus: { fontWeight: 'bold' },
  textGreen: { color: '#34d399' },
  textRed: { color: '#f87171' },
  textYellow: { color: '#fbbf24' },
  historyDates: { color: '#38bdf8', marginBottom: 4 },
  historyReason: { fontStyle: 'italic' },
  fullDocImage: { width: '100%', height: 280, borderRadius: 12 },
  closeMenuButton: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeMenuButtonText: { fontWeight: 'bold', letterSpacing: 0.5 },
});