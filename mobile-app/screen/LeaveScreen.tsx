import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import enTranslations from '../lang/en.json';
import arTranslations from '../lang/ar.json';

const translationsMap = {
  en: enTranslations,
  ar: arTranslations,
};

interface LeaveScreenProps {
  onBack: () => void;
  currentLang: 'en' | 'ar';
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  email: string;
  employeeName: string;
  role: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  leaveType: string;
  reason: string;
  documentUri?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  managerComment: string;
  createdAt: string;
}

export default function LeaveScreen({ onBack, currentLang }: LeaveScreenProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState('Annual');
  const [reason, setReason] = useState('');
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [userUniqueId, setUserUniqueId] = useState('#1945');
  const [userName, setUserName] = useState('Mukasa Fahad');
  const [userRole, setUserRole] = useState('Employee');
  const [userEmail, setUserEmail] = useState('fahadmukasa74@gmail.com');

  const totalDays = 30;
  const [usedDays, setUsedDays] = useState(0);
  const t = translationsMap[currentLang];

  useEffect(() => {
    loadLeaveData();
    const interval = setInterval(loadLeaveData, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadLeaveData = async () => {
    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const currentEmail = activeEmail ? activeEmail.trim().toLowerCase() : 'fahadmukasa74@gmail.com';
      
      // Read strictly from the required email-specific unique ID key format
      const specificEmailIdKey = `@user_unique_id_${currentEmail}`;
      const savedEmailSpecificId = await AsyncStorage.getItem(specificEmailIdKey);
      const savedGeneralId = await AsyncStorage.getItem('@user_unique_id');

      const currentId = savedEmailSpecificId || savedGeneralId || (currentEmail === 'fahadmukasa74@gmail.com' ? '#1945' : '#1945');

      const savedName = await AsyncStorage.getItem(`@full_name_${currentEmail}`);
      const savedRole = await AsyncStorage.getItem(`@role_${currentEmail}`);

      if (currentId) setUserUniqueId(currentId.startsWith('#') ? currentId : `#${currentId}`);
      if (savedName) setUserName(savedName);
      if (savedRole) setUserRole(savedRole);
      if (activeEmail) setUserEmail(currentEmail);

      const cleanEmail = currentEmail;
      const cleanId = currentId.replace('#', '');
      
      const specificLeaveKey = `@leave_request_${cleanEmail}_${cleanId}`;
      const savedSpecific = await AsyncStorage.getItem(specificLeaveKey);

      // --- FETCH FROM SUPABASE CLOUD DATABASE ---
      let combinedRequests: LeaveRequest[] = [];
      const { data: cloudLeaves, error: cloudError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('email', cleanEmail);

      if (!cloudError && cloudLeaves && cloudLeaves.length > 0) {
        combinedRequests = cloudLeaves.map((l: any) => ({
          id: l.id || `leave-${Date.now()}`,
          employeeId: l.employee_id || l.employeeId || currentId,
          email: l.email || cleanEmail,
          employeeName: l.employee_name || l.employeeName || userName,
          role: l.role || userRole,
          startDate: l.start_date || l.startDate || '',
          endDate: l.end_date || l.endDate || '',
          totalDays: l.total_days || l.totalDays || '3 Days',
          leaveType: l.leave_type || l.leaveType || 'Annual',
          reason: l.reason || '',
          documentUri: l.document_uri || l.documentUri || null,
          status: l.status || 'Pending',
          managerComment: l.manager_comment || l.managerComment || 'Awaiting manager review.',
          createdAt: l.created_at || l.createdAt || new Date().toISOString(),
        }));
      } else {
        const managementList = await AsyncStorage.getItem('@management_leave_requests');
        if (managementList) {
          const parsedMgmt: LeaveRequest[] = JSON.parse(managementList);
          combinedRequests = parsedMgmt.filter(
            (r) =>
              r.email &&
              r.email.trim().toLowerCase() === cleanEmail &&
              r.employeeId.replace('#', '') === cleanId
          );
        }
      }

      if (savedSpecific) {
        const parsedSpecific: LeaveRequest = JSON.parse(savedSpecific);
        if (!combinedRequests.some((r) => r.id === parsedSpecific.id)) {
          combinedRequests = [parsedSpecific, ...combinedRequests];
        }
      }

      setLeaveRequests(combinedRequests);
      calculateUsedDays(combinedRequests);
    } catch (error) {
      console.log('Failed to load leave data from cloud/storage', error);
    }
  };

  const calculateUsedDays = (requests: LeaveRequest[]) => {
    let days = 0;
    requests.forEach((req) => {
      if (req.status === 'Approved') {
        days += 3;
      }
    });
    setUsedDays(days);
  };

  const pickDocument = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Permission to access gallery is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setDocumentUri(result.assets[0].uri);
    }
  };

  const handleSubmitRequest = async () => {
    if (!startDate || !endDate || !reason) {
      Alert.alert(
        currentLang === 'ar' ? 'خطأ' : 'Error',
        currentLang === 'ar' ? 'يرجى تعبئة جميع حقول الإجازة المطلوبة.' : 'Please fill in all required leave fields.'
      );
      return;
    }

    const requestId = `leave-${Date.now()}`;
    const cleanEmail = userEmail.trim().toLowerCase();
    const cleanId = userUniqueId.replace('#', '');

    const newRequest: LeaveRequest = {
      id: requestId,
      employeeId: userUniqueId,
      email: cleanEmail,
      employeeName: userName,
      role: userRole,
      startDate,
      endDate,
      totalDays: '3 Days',
      leaveType,
      reason,
      documentUri: leaveType === 'Sick' ? documentUri : null,
      status: 'Pending',
      managerComment: currentLang === 'ar' ? 'في انتظار مراجعة المدير.' : 'Awaiting manager review.',
      createdAt: new Date().toISOString(),
    };

    try {
      // --- SYNC TO SUPABASE CLOUD DATABASE ---
      const { error: cloudError } = await supabase.from('leave_requests').upsert([
        {
          id: newRequest.id,
          employee_id: newRequest.employeeId,
          email: newRequest.email,
          employee_name: newRequest.employeeName,
          role: newRequest.role,
          start_date: newRequest.startDate,
          end_date: newRequest.endDate,
          total_days: newRequest.totalDays,
          leave_type: newRequest.leaveType,
          reason: newRequest.reason,
          document_uri: newRequest.documentUri,
          status: newRequest.status,
          manager_comment: newRequest.managerComment,
          created_at: newRequest.createdAt,
        },
      ]);

      if (cloudError) {
        console.log('Supabase leave submission error:', cloudError.message);
      }

      const specificLeaveKey = `@leave_request_${cleanEmail}_${cleanId}`;
      await AsyncStorage.setItem(specificLeaveKey, JSON.stringify(newRequest));

      if (leaveType === 'Sick' && documentUri) {
        const docKey = `@leave_document_${cleanEmail}_${cleanId}`;
        await AsyncStorage.setItem(docKey, documentUri);
      }

      const existingMgmt = await AsyncStorage.getItem('@management_leave_requests');
      const mgmtList = existingMgmt ? JSON.parse(existingMgmt) : [];
      const filteredMgmt = mgmtList.filter((r: LeaveRequest) => r.id !== requestId);
      const updatedMgmtList = [newRequest, ...filteredMgmt];
      await AsyncStorage.setItem('@management_leave_requests', JSON.stringify(updatedMgmtList));

      setLeaveRequests([newRequest, ...leaveRequests.filter(r => r.id !== requestId)]);
      setStartDate('');
      setEndDate('');
      setReason('');
      setDocumentUri(null);

      Alert.alert(
        currentLang === 'ar' ? 'نجاح' : 'Success',
        currentLang === 'ar'
          ? 'تم تقديم طلب الإجازة بنجاح وارساله لموافقة المدير عبر السحابة!'
          : 'Leave request submitted successfully & synced to cloud for manager approval!'
      );
    } catch (error) {
      console.log('Failed to submit leave request to cloud/storage', error);
    }
  };

  const remainingDays = totalDays - usedDays;

  return (
    <SafeAreaView style={[styles.safeArea, { direction: currentLang === 'ar' ? 'rtl' : 'ltr' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{t.back}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.leave}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.leaveBalance}</Text>
          <Text style={styles.rateSubText}>
            {t.portalTitle} <Text style={styles.idHighlightText}>ID: {userUniqueId}</Text>
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalDays}</Text>
              <Text style={styles.statLabel}>{t.available}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValueUsed}>{usedDays}</Text>
              <Text style={styles.statLabel}>{t.used}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValueRemaining}>{remainingDays}</Text>
              <Text style={styles.statLabel}>{t.remaining}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.requestLeave}</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={currentLang === 'ar' ? 'تاريخ البداية (YYYY-MM-DD)' : 'Start Date (YYYY-MM-DD)'}
              placeholderTextColor="#9ca3af"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={currentLang === 'ar' ? 'تاريخ النهاية (YYYY-MM-DD)' : 'End Date (YYYY-MM-DD)'}
              placeholderTextColor="#9ca3af"
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
          <Text style={styles.label}>{currentLang === 'ar' ? 'نوع الإجازة' : 'Leave Type'}</Text>
          <View style={styles.pillsRow}>
            {['Annual', 'Sick', 'Emergency', 'Unpaid'].map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.pill, leaveType === item && styles.pillActive]}
                onPress={() => setLeaveType(item)}
              >
                <Text style={[styles.pillText, leaveType === item && styles.pillTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={t.reason}
              placeholderTextColor="#9ca3af"
              value={reason}
              onChangeText={setReason}
            />
          </View>

          {leaveType === 'Sick' && (
            <View style={styles.uploadSection}>
              <Text style={styles.label}>
                {currentLang === 'ar' ? 'ملاحظة الطبيب مطلوبة لإجازة المرض' : 'Doctor Note / Medical Document'}
              </Text>
              <TouchableOpacity style={styles.uploadBtn} onPress={pickDocument}>
                <Text style={styles.uploadBtnText}>
                  {documentUri ? 'Document Attached' : '+ Upload Doctor Note'}
                </Text>
              </TouchableOpacity>
              {documentUri && (
                <Image source={{ uri: documentUri }} style={styles.previewImage} />
              )}
            </View>
          )}

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmitRequest}>
            <Text style={styles.submitButtonText}>{t.submitRequest}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {currentLang === 'ar' ? 'سجل تتبع الطلبات' : 'Request & Track Time Off'}
          </Text>
          {leaveRequests.length === 0 ? (
            <Text style={styles.noLogsText}>
              {currentLang === 'ar' ? 'لم يتم تقديم أي طلبات إجازة حتى الآن.' : 'No submitted leave requests yet.'}
            </Text>
          ) : (
            leaveRequests.map((req) => (
              <View key={req.id} style={styles.requestItem}>
                <View style={styles.requestHeaderRow}>
                  <Text style={styles.reqType}>{req.leaveType} Leave</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      req.status === 'Approved'
                        ? styles.statusApproved
                        : req.status === 'Rejected'
                        ? styles.statusRejected
                        : styles.statusPending,
                    ]}
                  >
                    {req.status}
                  </Text>
                </View>
                <Text style={styles.reqDates}>
                  {req.startDate} to {req.endDate}
                </Text>
                <Text style={styles.reqReason}>Reason: {req.reason}</Text>
                <Text style={styles.reqComment}>Manager Note: {req.managerComment}</Text>
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
  rateSubText: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  idHighlightText: { color: '#2b5267', fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  statBox: { flex: 1, backgroundColor: '#e2e8f0', borderRadius: 16, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  statValueUsed: { fontSize: 18, fontWeight: 'bold', color: '#b45309' },
  statValueRemaining: { fontSize: 18, fontWeight: 'bold', color: '#0f766e' },
  statLabel: { fontSize: 12, color: '#475569', marginTop: 4 },
  inputContainer: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginBottom: 16, paddingBottom: 4 },
  input: { fontSize: 15, color: '#1e293b', paddingVertical: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#e2e8f0' },
  pillActive: { backgroundColor: '#2b5267' },
  pillText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
  uploadSection: { marginBottom: 16 },
  uploadBtn: { backgroundColor: '#1e3a4c', padding: 10, borderRadius: 10, alignItems: 'center' },
  uploadBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  previewImage: { width: '100%', height: 120, borderRadius: 8, marginTop: 8, resizeMode: 'cover' },
  submitButton: { backgroundColor: '#2b5267', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
  noLogsText: { fontSize: 14, color: '#64748b', fontStyle: 'italic', marginTop: 4 },
  requestItem: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#2b5267' },
  requestHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reqType: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  statusBadge: { fontSize: 12, fontWeight: 'bold', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden', color: '#ffffff' },
  statusPending: { backgroundColor: '#b45309' },
  statusApproved: { backgroundColor: '#0f766e' },
  statusRejected: { backgroundColor: '#dc2626' },
  reqDates: { fontSize: 13, color: '#334155', fontWeight: '600', marginBottom: 4 },
  reqReason: { fontSize: 13, color: '#475569', marginBottom: 2 },
  reqComment: { fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 4 },
});