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

interface PayslipDetails {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  overtime: number;
  latePenalties: number;
  loans: number;
  insurance: number;
  paymentDate: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

interface PayslipRecord {
  id: string;
  email: string;
  employeeId: string;
  employeeName: string;
  role: 'Employee' | 'Manager' | 'Supervisor' | 'Admin';
  department: string;
  month: string;
  grossSalary: number;
  totalDeductions: number;
  netPay: number;
  status: 'Pending' | 'Verified' | 'Paid' | 'Rejected';
  details: PayslipDetails;
  storageKey?: string;
}

interface PayslipManagementScreenProps {
  onBack: () => void;
  onOpenAttendanceLogs: () => void;
  onOpenLeaveManagement: () => void;
  onViewPayslipsScreen?: (employeeId: string) => void;
  currentTheme?: 'Dark' | 'Light';
  onThemeChange?: (theme: 'Dark' | 'Light') => void;
  currentFontSize?: 'Small' | 'Medium' | 'Large';
  onFontSizeChange?: (size: 'Small' | 'Medium' | 'Large') => void;
  globalTextStyle?: { fontSize: number; lineHeight: number };
}

export default function PayslipManagementScreen({
  onBack,
  onOpenAttendanceLogs,
  onOpenLeaveManagement,
  onViewPayslipsScreen,
  currentTheme = 'Dark',
  onThemeChange,
  currentFontSize = 'Medium',
  onFontSizeChange,
  globalTextStyle,
}: PayslipManagementScreenProps) {
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState('All');
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [portalLang, setPortalLang] = useState<'en' | 'ar'>('en');

  // Breakdown & Edit Modal State
  const [breakdownVisible, setBreakdownVisible] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRecord | null>(null);

  // Editable fields state for Admin
  const [editBasic, setEditBasic] = useState('');
  const [editHousing, setEditHousing] = useState('');
  const [editTransport, setEditTransport] = useState('');
  const [editOvertime, setEditOvertime] = useState('');
  const [editPenalties, setEditPenalties] = useState('');
  const [editLoans, setEditLoans] = useState('');
  const [editInsurance, setEditInsurance] = useState('');

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
    loadPreferencesAndPayslips();
    const interval = setInterval(loadPayslips, 3000);
    return () => {
      clearInterval(interval);
      subscription?.remove();
    };
  }, []);

  const loadPreferencesAndPayslips = async () => {
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
    } catch (error) {
      console.log('Failed to load portal preferences', error);
    }
    loadPayslips();
  };

  const loadPayslips = async () => {
    try {
      const savedWorkersJson = await AsyncStorage.getItem('@registered_workers_list');
      const workers = savedWorkersJson
        ? JSON.parse(savedWorkersJson)
        : [
            { email: 'fahadmukasa74@gmail.com', id: '#1945', name: 'Mukasa Fahad', role: 'Manager', department: 'Engineering & AI' },
            { email: 'havarain@gmail.com', id: '#5984', name: 'Olivia Nimusiima', role: 'Employee', department: 'Service Department' },
          ];

      const loadedRecords: PayslipRecord[] = [];
      
      // --- FETCH FROM SUPABASE CLOUD DATABASE ---
      const { data: cloudPayslips, error: cloudError } = await supabase.from('payslips').select('*');

      for (const worker of workers) {
        const workerEmail = worker.email ? worker.email.trim().toLowerCase() : 'fahadmukasa74@gmail.com';
        const workerId = worker.id || '#1945';
        const cleanId = workerId.replace('#', '');
        const monthYear = 'August_2026';
        const slipKey = `@payslip_${workerEmail}_${cleanId}_${monthYear}`;

        // Match with Supabase cloud data if available
        const cloudMatch = cloudPayslips?.find(
          (cp: any) =>
            (cp.email && cp.email.trim().toLowerCase() === workerEmail) ||
            (cp.employee_id && cp.employee_id.replace('#', '') === cleanId)
        );

        let status: 'Pending' | 'Verified' | 'Paid' | 'Rejected' = cloudMatch?.status || 'Pending';
        let details: PayslipDetails = {
          basicSalary: cloudMatch?.basic_salary ?? (workerId === '#1945' ? 10000 : 5000),
          housingAllowance: cloudMatch?.housing_allowance ?? (workerId === '#1945' ? 3000 : 2000),
          transportAllowance: cloudMatch?.transport_allowance ?? 1000,
          overtime: cloudMatch?.overtime ?? (workerId === '#1945' ? 1000 : 0),
          latePenalties: cloudMatch?.late_penalties ?? 0,
          loans: cloudMatch?.loans ?? 0,
          insurance: cloudMatch?.insurance ?? (workerId === '#1945' ? 750 : 400),
          paymentDate: cloudMatch?.payment_date || '2026-08-30',
          lastUpdatedBy: cloudMatch?.last_updated_by,
          lastUpdatedAt: cloudMatch?.last_updated_at,
        };

        const savedSlipJson = await AsyncStorage.getItem(slipKey);
        if (savedSlipJson && !cloudMatch) {
          try {
            const parsed = JSON.parse(savedSlipJson);
            if (parsed.status) status = parsed.status;
            if (parsed.details) details = { ...details, ...parsed.details };
          } catch (e) {
            console.log('Error parsing slip JSON', e);
          }
        }

        const gross = details.basicSalary + details.housingAllowance + details.transportAllowance + details.overtime;
        const deductions = details.latePenalties + details.loans + details.insurance;
        const net = gross - deductions;

        loadedRecords.push({
          id: `pay-${workerEmail}-${cleanId}`,
          email: workerEmail,
          employeeId: workerId.startsWith('#') ? workerId : `#${workerId}`,
          employeeName: worker.fullName || worker.name || 'Staff Member',
          role: worker.role || 'Employee',
          department: worker.department || 'General Staff',
          month: 'August 2026',
          grossSalary: gross,
          totalDeductions: deductions,
          netPay: net,
          status,
          details,
          storageKey: slipKey,
        });
      }
      setPayslips(loadedRecords);
    } catch (error) {
      console.log('Failed to load payslips from cloud/storage', error);
    }
  };

  const updatePayslipStatus = async (targetRecord: PayslipRecord, decision: 'Verified' | 'Rejected' | 'Paid') => {
    try {
      const key = targetRecord.storageKey || `@payslip_${targetRecord.email}_${targetRecord.employeeId.replace('#', '')}_August_2026`;
      const existingDataStr = await AsyncStorage.getItem(key);
      const data = existingDataStr ? JSON.parse(existingDataStr) : {};
      
      data.status = decision;
      data.employeeId = targetRecord.employeeId;
      data.email = targetRecord.email;
      data.month = targetRecord.month;
      data.details = targetRecord.details;

      await AsyncStorage.setItem(key, JSON.stringify(data));

      // --- SYNC STATUS TO SUPABASE CLOUD ---
      const { error: cloudError } = await supabase.from('payslips').upsert([
        {
          employee_id: targetRecord.employeeId,
          email: targetRecord.email,
          month: targetRecord.month,
          status: decision,
          basic_salary: targetRecord.details.basicSalary,
          housing_allowance: targetRecord.details.housingAllowance,
          transport_allowance: targetRecord.details.transportAllowance,
          overtime: targetRecord.details.overtime,
          late_penalties: targetRecord.details.latePenalties,
          loans: targetRecord.details.loans,
          insurance: targetRecord.details.insurance,
          payment_date: targetRecord.details.paymentDate,
          last_updated_by: targetRecord.details.lastUpdatedBy,
          last_updated_at: targetRecord.details.lastUpdatedAt,
        },
      ], { onConflict: 'email,month' });

      if (cloudError) {
        console.log('Supabase status update error:', cloudError.message);
      }

      const updated = payslips.map((p) => (p.id === targetRecord.id ? { ...p, status: decision } : p));
      setPayslips(updated);
      if (selectedPayslip?.id === targetRecord.id) {
        setSelectedPayslip({ ...selectedPayslip, status: decision });
      }

      Alert.alert(isRTL ? 'تحديث الحالة' : 'Status Updated', `Payslip for ${targetRecord.employeeName} has been marked as ${decision}.`);
    } catch (error) {
      console.log('Failed to update payslip status', error);
      Alert.alert(isRTL ? 'خطأ' : 'Error', 'Failed to update status.');
    }
  };

  const handleViewBreakdown = (payslip: PayslipRecord) => {
    setSelectedPayslip(payslip);
    setEditBasic(payslip.details.basicSalary.toString());
    setEditHousing(payslip.details.housingAllowance.toString());
    setEditTransport(payslip.details.transportAllowance.toString());
    setEditOvertime(payslip.details.overtime.toString());
    setEditPenalties(payslip.details.latePenalties.toString());
    setEditLoans(payslip.details.loans.toString());
    setEditInsurance(payslip.details.insurance.toString());
    setBreakdownVisible(true);
  };

  const handleSavePayslipEdits = async () => {
    if (!selectedPayslip) return;

    const newBasic = parseFloat(editBasic) || 0;
    const newHousing = parseFloat(editHousing) || 0;
    const newTransport = parseFloat(editTransport) || 0;
    const newOvertime = parseFloat(editOvertime) || 0;
    const newPenalties = parseFloat(editPenalties) || 0;
    const newLoans = parseFloat(editLoans) || 0;
    const newInsurance = parseFloat(editInsurance) || 0;

    const newGross = newBasic + newHousing + newTransport + newOvertime;
    const newDeductions = newPenalties + newLoans + newInsurance;
    const newNet = newGross - newDeductions;

    const auditTimestamp = new Date().toISOString();
    const adminIdentifier = 'Admin (Fahad Mukasa)';

    const updatedDetails: PayslipDetails = {
      ...selectedPayslip.details,
      basicSalary: newBasic,
      housingAllowance: newHousing,
      transportAllowance: newTransport,
      overtime: newOvertime,
      latePenalties: newPenalties,
      loans: newLoans,
      insurance: newInsurance,
      lastUpdatedBy: adminIdentifier,
      lastUpdatedAt: auditTimestamp,
    };

    try {
      const key = selectedPayslip.storageKey || `@payslip_${selectedPayslip.email}_${selectedPayslip.employeeId.replace('#', '')}_August_2026`;
      
      const payload = {
        employeeId: selectedPayslip.employeeId,
        email: selectedPayslip.email,
        month: selectedPayslip.month,
        status: selectedPayslip.status,
        details: updatedDetails,
      };

      await AsyncStorage.setItem(key, JSON.stringify(payload));

      const globalKey = `@payslip_record_${selectedPayslip.email}_${selectedPayslip.employeeId.replace('#', '')}`;
      await AsyncStorage.setItem(globalKey, JSON.stringify(payload));

      // --- SYNC UPDATED BREAKDOWN TO SUPABASE CLOUD ---
      const { error: cloudError } = await supabase.from('payslips').upsert([
        {
          employee_id: selectedPayslip.employeeId,
          email: selectedPayslip.email,
          month: selectedPayslip.month,
          status: selectedPayslip.status,
          basic_salary: newBasic,
          housing_allowance: newHousing,
          transport_allowance: newTransport,
          overtime: newOvertime,
          late_penalties: newPenalties,
          loans: newLoans,
          insurance: newInsurance,
          payment_date: selectedPayslip.details.paymentDate,
          last_updated_by: adminIdentifier,
          last_updated_at: auditTimestamp,
        },
      ], { onConflict: 'email,month' });

      if (cloudError) {
        console.log('Supabase payroll edit sync error:', cloudError.message);
      }

      const updatedRecord: PayslipRecord = {
        ...selectedPayslip,
        grossSalary: newGross,
        totalDeductions: newDeductions,
        netPay: newNet,
        details: updatedDetails,
      };

      setPayslips(payslips.map((p) => (p.id === selectedPayslip.id ? updatedRecord : p)));
      setSelectedPayslip(updatedRecord);

      Alert.alert(
        'Success',
        `Payslip for ${selectedPayslip.employeeName} successfully updated & synced to cloud.\nGross: AED ${newGross.toLocaleString()}, Deductions: AED ${newDeductions.toLocaleString()}, Net: AED ${newNet.toLocaleString()}`
      );
    } catch (error) {
      console.log('Failed to save payslip edits to cloud/storage', error);
      Alert.alert('Error', 'Failed to save changes to database.');
    }
  };

  const handleNavigateToPayslipsScreen = (employeeId: string) => {
    if (onViewPayslipsScreen) {
      onViewPayslipsScreen(employeeId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return styles.statusPending;
      case 'Verified': return styles.statusVerified;
      case 'Paid': return styles.statusPaid;
      case 'Rejected': return styles.statusRejected;
      default: return styles.statusPending;
    }
  };

  const filteredPayslips = payslips.filter((p) => {
    const matchesSearch =
      p.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatusFilter === 'All' || p.status === selectedStatusFilter;
    const matchesMonth = selectedMonthFilter === 'All' || p.month === selectedMonthFilter;
    return matchesSearch && matchesStatus && matchesMonth;
  });

  const isDesktop = windowWidth > 900;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isLight ? '#f1f5f9' : '#2b5267', direction: isRTL ? 'rtl' : 'ltr' } as any]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]} onPress={onBack}>
            <Text style={[styles.backButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
              {isRTL ? 'العودة إلى لوحة التحكم' : 'Back to Dashboard'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'قسائم الرواتب والتحقق من الأجور' : 'Payslip & Salary Verification'}
          </Text>
        </View>

        <View style={[styles.quickLinksCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.quickLinksTitle, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'مصفوفة الربط المرجعي (الخصومات والوقت الإضافي)' : 'Cross-Reference Matrix (Deductions & Overtime)'}
          </Text>
          <View style={[styles.quickLinksRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenAttendanceLogs}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                {isRTL ? 'التحقق من سجلات الحضور' : 'Validate Attendance Logs'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenLeaveManagement}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                {isRTL ? 'التحقق من سجلات الإجازات' : 'Check Leave Records'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.sectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'البحث وتصفية الرواتب' : 'Search & Filter Payroll'}
          </Text>
          <TextInput
            style={[
              styles.searchInput,
              activeTextStyle,
              {
                backgroundColor: isLight ? '#f8fafc' : '#0f172a',
                color: isLight ? '#0f172a' : '#ffffff',
                borderColor: isLight ? '#cbd5e1' : '#334155',
              },
              isRTL && { textAlign: 'right' },
            ]}
            placeholder={isRTL ? 'البحث برقم المعرف أو اسم الموظف أو القسم...' : 'Search by ID #, employee name or department...'}
            placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'تصفية حسب الحالة:' : 'Status Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Pending', 'Verified', 'Paid', 'Rejected'].map((status) => (
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
              {isRTL ? 'تصفية حسب الفترة:' : 'Period Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'August 2026', 'July 2026'].map((month) => (
                <TouchableOpacity
                  key={month}
                  style={[styles.pill, { backgroundColor: isLight ? '#f8fafc' : '#1e3a4c' }, selectedMonthFilter === month && styles.pillActive]}
                  onPress={() => setSelectedMonthFilter(month)}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedMonthFilter === month && styles.pillTextActive]}>
                    {month}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop, isRTL && { flexDirection: 'row-reverse' }]}>
          {filteredPayslips.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
              <Text style={[styles.emptyText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'لم يتم العثور على سجلات رواتب تطابق معايير البحث.' : 'No salary records found matching your criteria.'}
              </Text>
            </View>
          ) : (
            filteredPayslips.map((pay) => (
              <View
                key={pay.id}
                style={[
                  styles.payslipCard,
                  { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' },
                  isDesktop && styles.payslipCardDesktop,
                ]}
              >
                <View style={[styles.payslipCardTop, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <TouchableOpacity onPress={() => handleNavigateToPayslipsScreen(pay.employeeId)}>
                      <Text style={[styles.employeeNameLink, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>
                        {pay.employeeName}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.employeeMetaText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                      <Text style={styles.idHighlightText}>ID: {pay.employeeId}</Text> • {pay.role}
                    </Text>
                    <Text style={[styles.roleText, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                      {pay.department}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, getStatusColor(pay.status)]}>
                    <Text style={[styles.statusText, activeTextStyle]}>
                      {pay.status === 'Verified' ? 'Verified' : pay.status === 'Rejected' ? 'Rejected' : pay.status === 'Paid' ? 'Paid' : 'Pending'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.salaryBox, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                  <Text style={[styles.periodText, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>
                    Period: {pay.month}
                  </Text>
                  <View style={[styles.financialRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.financeLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>
                      {isRTL ? 'الإجمالي:' : 'Gross:'}
                    </Text>
                    <Text style={[styles.grossText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                      AED {pay.grossSalary.toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.financialRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.financeLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>
                      {isRTL ? 'الخصومات:' : 'Deductions:'}
                    </Text>
                    <Text style={[styles.deductionText, activeTextStyle]}>
                      - AED {pay.totalDeductions.toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.financialRow, styles.netRow, { borderTopColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.netLabel, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                      {isRTL ? 'صافي الراتب:' : 'NET PAY:'}
                    </Text>
                    <Text style={[styles.netText, activeTextStyle]}>
                      AED {pay.netPay.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={[styles.actionsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <TouchableOpacity style={styles.actionBtnPrimary} onPress={() => handleViewBreakdown(pay)}>
                    <Text style={[styles.actionBtnText, activeTextStyle]}>
                      {isRTL ? 'عرض وتعديل' : 'Edit & View'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnVerify} onPress={() => updatePayslipStatus(pay, 'Verified')}>
                    <Text style={[styles.actionBtnText, activeTextStyle]}>
                      {isRTL ? 'موافقة' : 'Approve'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnReject} onPress={() => updatePayslipStatus(pay, 'Rejected')}>
                    <Text style={[styles.actionBtnText, activeTextStyle]}>
                      {isRTL ? 'رفض' : 'Reject'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtnSecondary,
                      {
                        backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c',
                        borderColor: isLight ? '#94a3b8' : '#2b5267',
                      },
                    ]}
                    onPress={() => handleNavigateToPayslipsScreen(pay.employeeId)}
                  >
                    <Text style={[styles.actionBtnText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                      {isRTL ? 'فتح' : 'Open'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Detailed Breakdown & Editable Modal */}
      <Modal animationType="slide" transparent={true} visible={breakdownVisible} onRequestClose={() => setBreakdownVisible(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: isLight ? '#ffffff' : '#12202a',
                borderColor: isLight ? '#e2e8f0' : '#1e3a4c',
              },
              { direction: isRTL ? 'rtl' : 'ltr' } as any,
            ]}
          >
            {selectedPayslip && (
              <>
                <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                    {isRTL ? 'إدارة وتعديل تفاصيل قسيمة الراتب' : 'Edit & Manage Payslip Details'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}
                    onPress={() => setBreakdownVisible(false)}
                  >
                    <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>X</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                  <View style={styles.breakdownEmpInfo}>
                    <Text style={[styles.bName, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                      {selectedPayslip.employeeName} <Text style={styles.idHighlightText}>ID: {selectedPayslip.employeeId}</Text>
                    </Text>
                    <Text style={[styles.bRole, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                      {selectedPayslip.role} • {selectedPayslip.department}
                    </Text>
                    <Text style={[styles.bPeriod, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>
                      Period: {selectedPayslip.month}
                    </Text>
                    <View style={[styles.statusBadge, getStatusColor(selectedPayslip.status), { alignSelf: isRTL ? 'flex-end' : 'flex-start', marginTop: 8 }]}>
                      <Text style={[styles.statusText, activeTextStyle]}>{selectedPayslip.status}</Text>
                    </View>
                    {selectedPayslip.details.lastUpdatedBy && (
                      <Text style={[styles.auditText, activeTextStyle, { marginTop: 6 }]}>
                        Last edited by {selectedPayslip.details.lastUpdatedBy} on {new Date(selectedPayslip.details.lastUpdatedAt || '').toLocaleString()}
                      </Text>
                    )}
                  </View>

                  <Text style={[styles.breakdownSectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                    {isRTL ? 'الأرباح والبدلات (قابل للتعديل)' : 'Earnings & Allowances (Editable)'}
                  </Text>
                  <View style={[styles.breakdownCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                    <View style={[styles.editRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.bLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>Basic Salary (AED):</Text>
                      <TextInput
                        style={[styles.editInput, activeTextStyle, { backgroundColor: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }]}
                        keyboardType="numeric"
                        value={editBasic}
                        onChangeText={setEditBasic}
                      />
                    </View>
                    <View style={[styles.editRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.bLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>Housing Allowance (AED):</Text>
                      <TextInput
                        style={[styles.editInput, activeTextStyle, { backgroundColor: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }]}
                        keyboardType="numeric"
                        value={editHousing}
                        onChangeText={setEditHousing}
                      />
                    </View>
                    <View style={[styles.editRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.bLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>Transport Allowance (AED):</Text>
                      <TextInput
                        style={[styles.editInput, activeTextStyle, { backgroundColor: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }]}
                        keyboardType="numeric"
                        value={editTransport}
                        onChangeText={setEditTransport}
                      />
                    </View>
                    <View style={[styles.editRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.bLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>Overtime Pay (AED):</Text>
                      <TextInput
                        style={[styles.editInput, activeTextStyle, { backgroundColor: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }]}
                        keyboardType="numeric"
                        value={editOvertime}
                        onChangeText={setEditOvertime}
                      />
                    </View>
                  </View>

                  <Text style={[styles.breakdownSectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                    {isRTL ? 'الخصومات (قابل للتعديل)' : 'Deductions (Editable)'}
                  </Text>
                  <View style={[styles.breakdownCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
                    <View style={[styles.editRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.bLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>Late Penalties & Absences (AED):</Text>
                      <TextInput
                        style={[styles.editInput, activeTextStyle, { backgroundColor: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }]}
                        keyboardType="numeric"
                        value={editPenalties}
                        onChangeText={setEditPenalties}
                      />
                    </View>
                    <View style={[styles.editRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.bLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>Loan Repayment (AED):</Text>
                      <TextInput
                        style={[styles.editInput, activeTextStyle, { backgroundColor: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }]}
                        keyboardType="numeric"
                        value={editLoans}
                        onChangeText={setEditLoans}
                      />
                    </View>
                    <View style={[styles.editRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.bLabel, activeTextStyle, { color: isLight ? '#475569' : '#cbd5e1' }]}>Health Insurance (AED):</Text>
                      <TextInput
                        style={[styles.editInput, activeTextStyle, { backgroundColor: isLight ? '#ffffff' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }]}
                        keyboardType="numeric"
                        value={editInsurance}
                        onChangeText={setEditInsurance}
                      />
                    </View>
                  </View>

                  <View style={styles.finalNetBox}>
                    <Text style={[styles.finalNetLabel, activeTextStyle]}>RECALCULATED FINAL NET PAYABLE</Text>
                    <Text style={[styles.finalNetValue, activeTextStyle]}>
                      AED {((parseFloat(editBasic) || 0) + (parseFloat(editHousing) || 0) + (parseFloat(editTransport) || 0) + (parseFloat(editOvertime) || 0) - ((parseFloat(editPenalties) || 0) + (parseFloat(editLoans) || 0) + (parseFloat(editInsurance) || 0))).toLocaleString()}
                    </Text>
                    <Text style={[styles.payDateText, activeTextStyle]}>Payment Date: {selectedPayslip.details.paymentDate}</Text>
                  </View>
                </ScrollView>

                <View style={[styles.modalActionFooter, { borderTopColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
                  <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleSavePayslipEdits}>
                    <Text style={[styles.actionBtnText, activeTextStyle]}>Save Changes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtnVerify} onPress={() => updatePayslipStatus(selectedPayslip, 'Verified')}>
                    <Text style={[styles.actionBtnText, activeTextStyle]}>Verify & Approve</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  payslipCard: { width: '100%', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  payslipCardDesktop: { width: '48%', minWidth: 400, flexGrow: 1 },
  payslipCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  employeeNameLink: { fontWeight: 'bold', marginBottom: 2 },
  employeeMetaText: { marginBottom: 2 },
  idHighlightText: { color: '#f59e0b', fontWeight: 'bold' },
  roleText: {},
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  statusPending: { backgroundColor: '#78350f' },
  statusVerified: { backgroundColor: '#065f46' },
  statusPaid: { backgroundColor: '#1e40af' },
  statusRejected: { backgroundColor: '#991b1b' },
  statusText: { color: '#ffffff', fontWeight: 'bold' },
  salaryBox: { padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1 },
  periodText: { fontWeight: 'bold', marginBottom: 10 },
  financialRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  financeLabel: {},
  grossText: { fontWeight: '500' },
  deductionText: { color: '#ef4444', fontWeight: '500' },
  netRow: { borderTopWidth: 1, marginTop: 6, paddingTop: 10 },
  netLabel: { fontWeight: 'bold' },
  netText: { fontWeight: 'bold', color: '#34d399' },
  actionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtnPrimary: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 10, alignItems: 'center', minWidth: 70 },
  actionBtnVerify: { flex: 1, backgroundColor: '#065f46', paddingVertical: 10, borderRadius: 10, alignItems: 'center', minWidth: 70 },
  actionBtnReject: { flex: 1, backgroundColor: '#991b1b', paddingVertical: 10, borderRadius: 10, alignItems: 'center', minWidth: 70 },
  actionBtnSecondary: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, minWidth: 70 },
  actionBtnText: { color: '#ffffff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 540, maxHeight: '90%', borderRadius: 24, padding: 24, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 16, marginBottom: 16 },
  modalTitle: { fontWeight: 'bold', fontSize: 18 },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeIconText: { fontWeight: 'bold' },
  modalScroll: { marginBottom: 16 },
  breakdownEmpInfo: { marginBottom: 20 },
  bName: { fontWeight: 'bold', marginBottom: 4, fontSize: 16 },
  bRole: { marginBottom: 4 },
  bPeriod: { fontWeight: 'bold' },
  auditText: { fontSize: 12, color: '#38bdf8', fontStyle: 'italic' },
  breakdownSectionTitle: { fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
  breakdownCard: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 10 },
  editRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  bLabel: { flex: 1 },
  editInput: { width: 120, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, textAlign: 'right', fontWeight: 'bold' },
  finalNetBox: { backgroundColor: '#064e3b', borderRadius: 12, padding: 20, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#059669' },
  finalNetLabel: { color: '#6ee7b7', fontWeight: 'bold', letterSpacing: 1, marginBottom: 4 },
  finalNetValue: { fontWeight: 'bold', color: '#ffffff', marginBottom: 8, fontSize: 18 },
  payDateText: { color: '#a7f3d0', fontStyle: 'italic' },
  modalActionFooter: { flexDirection: 'row', gap: 12, borderTopWidth: 1, paddingTop: 16 },
});