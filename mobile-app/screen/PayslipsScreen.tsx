import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import enTranslations from '../lang/en.json';
import arTranslations from '../lang/ar.json';

const translationsMap = {
  en: enTranslations,
  ar: arTranslations,
};

interface PayslipsScreenProps {
  onBack: () => void;
  currentLang: 'en' | 'ar';
  viewedEmployeeId?: string; // Supports viewing specific employee payslip if triggered by admin
}

interface TimeLog {
  checkIn: number | string;
  checkOut: number | string | null;
  hoursWorked: number;
  earnings: number;
}

export default function PayslipsScreen({ onBack, currentLang, viewedEmployeeId }: PayslipsScreenProps) {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [totalHoursMonth, setTotalHoursMonth] = useState(0);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [userUniqueId, setUserUniqueId] = useState('#1945');
  const [userName, setUserName] = useState('Mukasa Fahad');
  const [userEmail, setUserEmail] = useState('fahadmukasa74@gmail.com');
  
  // Real Payslip Data synced from Supabase Cloud / AsyncStorage
  const [basicSalary, setBasicSalary] = useState(10000);
  const [housingAllowance, setHousingAllowance] = useState(3000);
  const [transportAllowance, setTransportAllowance] = useState(1000);
  const [overtimePay, setOvertimePay] = useState(1000);
  const [latePenalties, setLatePenalties] = useState(0);
  const [loans, setLoans] = useState(0);
  const [insurance, setInsurance] = useState(750);
  const [paymentDate, setPaymentDate] = useState('2026-08-30');
  const [payslipStatus, setPayslipStatus] = useState('Verified');
  const [auditInfo, setAuditInfo] = useState<string | null>(null);

  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const t: any = translationsMap[currentLang];

  useEffect(() => {
    loadPayslipData();
  }, [viewedEmployeeId]);

  const loadPayslipData = async () => {
    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const resolvedEmail = activeEmail ? activeEmail.trim().toLowerCase() : 'fahadmukasa74@gmail.com';

      // Robustly resolve the unique ID corresponding to this session email or viewed prop
      const cleanEmailKey = resolvedEmail.replace(/[@.]/g, '_');
      const savedEmailSpecificId = await AsyncStorage.getItem(`@user_unique_id_${resolvedEmail}`);
      const savedGeneralId = await AsyncStorage.getItem('@user_unique_id');

      let resolvedId = viewedEmployeeId || savedEmailSpecificId || savedGeneralId || (resolvedEmail.includes('omega') || resolvedEmail.includes('fahad') ? '#7229' : '#1945');
      if (!resolvedId.startsWith('#')) {
        resolvedId = `#${resolvedId}`;
      }

      const cleanId = resolvedId.replace('#', '');

      // Load correct full name associated with this email
      const savedName = await AsyncStorage.getItem(`@full_name_${resolvedEmail}`);
      if (savedName) {
        setUserName(savedName);
      } else if (resolvedEmail.includes('omega')) {
        setUserName('OMEGA 256');
      } else if (resolvedEmail === 'fahadmukasa74@gmail.com') {
        setUserName('FAHAD MUKASA');
      }

      setUserUniqueId(resolvedId);
      setUserEmail(resolvedEmail);

      // --- FETCH FROM SUPABASE CLOUD DATABASE ---
      let cloudRecordFound = false;
      const { data: cloudPayslips, error: cloudError } = await supabase
        .from('payslips')
        .select('*');

      if (!cloudError && cloudPayslips && cloudPayslips.length > 0) {
        const cloudMatch = cloudPayslips.find(
          (cp: any) =>
            (cp.email && cp.email.trim().toLowerCase() === resolvedEmail) ||
            (cp.employee_id && cp.employee_id.replace('#', '') === cleanId)
        );

        if (cloudMatch) {
          cloudRecordFound = true;
          if (cloudMatch.status) setPayslipStatus(cloudMatch.status);
          setBasicSalary(cloudMatch.basic_salary ?? 10000);
          setHousingAllowance(cloudMatch.housing_allowance ?? 3000);
          setTransportAllowance(cloudMatch.transport_allowance ?? 1000);
          setOvertimePay(cloudMatch.overtime ?? 1000);
          setLatePenalties(cloudMatch.late_penalties ?? 0);
          setLoans(cloudMatch.loans ?? 0);
          setInsurance(cloudMatch.insurance ?? 750);
          if (cloudMatch.payment_date) setPaymentDate(cloudMatch.payment_date);
          if (cloudMatch.last_updated_by) {
            setAuditInfo(`Updated by ${cloudMatch.last_updated_by} on ${new Date(cloudMatch.last_updated_at || '').toLocaleString()}`);
          }
        }
      }

      // Fallback to local storage if not found in cloud
      if (!cloudRecordFound) {
        const payslipKey = `@payslip_${resolvedEmail}_${cleanId}_August_2026`;
        const savedPayslipData = await AsyncStorage.getItem(payslipKey);

        if (savedPayslipData) {
          const parsed = JSON.parse(savedPayslipData);
          if (parsed.status) setPayslipStatus(parsed.status);
          if (parsed.details) {
            setBasicSalary(parsed.details.basicSalary ?? 10000);
            setHousingAllowance(parsed.details.housingAllowance ?? 3000);
            setTransportAllowance(parsed.details.transportAllowance ?? 1000);
            setOvertimePay(parsed.details.overtime ?? 1000);
            setLatePenalties(parsed.details.latePenalties ?? 0);
            setLoans(parsed.details.loans ?? 0);
            setInsurance(parsed.details.insurance ?? 750);
            if (parsed.details.paymentDate) setPaymentDate(parsed.details.paymentDate);
            if (parsed.details.lastUpdatedBy) {
              setAuditInfo(`Updated by ${parsed.details.lastUpdatedBy} on ${new Date(parsed.details.lastUpdatedAt).toLocaleString()}`);
            }
          }
        }
      }

      // Load attendance logs
      const logsKey = `@attendance_logs_${resolvedEmail}_${cleanId}`;
      const savedLogsJson = await AsyncStorage.getItem(logsKey);
      if (savedLogsJson) {
        const parsedLogs = JSON.parse(savedLogsJson);
        setLogs(parsedLogs);
        calculateMonthlyTotals(parsedLogs);
      }
    } catch (error) {
      console.log('Failed to load payslip data from cloud/storage', error);
    }
  };

  const calculateMonthlyTotals = (currentLogs: TimeLog[]) => {
    let hoursSum = 0;
    let overtimeSum = 0;
    currentLogs.forEach((log) => {
      if (!log.checkIn) return;
      hoursSum += Number(log.hoursWorked) || 0;
      if (Number(log.hoursWorked) > 8) {
        overtimeSum += Number(log.hoursWorked) - 8;
      }
    });
    setTotalHoursMonth(Number(hoursSum.toFixed(2)));
    setOvertimeHours(Number(overtimeSum.toFixed(2)));
  };

  const grossSalary = basicSalary + housingAllowance + transportAllowance + overtimePay;
  const totalDeductions = latePenalties + loans + insurance;
  const netPayable = grossSalary - totalDeductions;

  const formatLogDate = (checkIn: number | string) => {
    if (!checkIn) return 'August 19, 2026';
    const date = new Date(typeof checkIn === 'number' ? checkIn : checkIn);
    if (isNaN(date.getTime())) return 'August 19, 2026';
    return date.toLocaleString(currentLang === 'ar' ? 'ar-AE' : 'en-US');
  };

  const generatePayslipHTML = () => `
    <html>
      <head>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; padding: 24px; color: #0f172a; background-color: #f8fafc; }
          .header { text-align: center; border-bottom: 2px solid #2b5267; padding-bottom: 12px; margin-bottom: 20px; }
          .restaurant { font-size: 20px; font-weight: bold; color: #2b5267; }
          .title { font-size: 16px; color: #64748b; margin-top: 4px; }
          .section { background: #ffffff; padding: 16px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #cbd5e1; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
          .label { font-size: 14px; color: #64748b; }
          .value { font-size: 14px; font-weight: bold; color: #0f172a; }
          .total-row { display: flex; justify-content: space-between; padding-top: 10px; font-size: 16px; font-weight: bold; color: #0d9488; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="restaurant">Propaganda Restaurant Al Bateen</div>
          <div class="title">Official Monthly Payslip August 2026</div>
        </div>
        <div class="section">
          <div class="row"><span class="label">Employee Name:</span><span class="value">${userName}</span></div>
          <div class="row"><span class="label">Employee ID:</span><span class="value">${userUniqueId}</span></div>
          <div class="row"><span class="label">Date Range:</span><span class="value">August 01, 2026 - August 31, 2026</span></div>
          <div class="row"><span class="label">Status:</span><span class="value">${payslipStatus}</span></div>
        </div>
        <div class="section">
          <div class="row"><span class="label">Basic Salary:</span><span class="value">${basicSalary.toLocaleString()} AED</span></div>
          <div class="row"><span class="label">Housing Allowance:</span><span class="value">${housingAllowance.toLocaleString()} AED</span></div>
          <div class="row"><span class="label">Transport Allowance:</span><span class="value">${transportAllowance.toLocaleString()} AED</span></div>
          <div class="row"><span class="label">Overtime Pay:</span><span class="value">+${overtimePay.toLocaleString()} AED</span></div>
          <div class="row"><span class="label">Gross Salary:</span><span class="value">${grossSalary.toLocaleString()} AED</span></div>
          <div class="row"><span class="label">Total Deductions:</span><span class="value">-${totalDeductions.toLocaleString()} AED</span></div>
          <div class="total-row"><span>Net Payable Amount:</span><span>${netPayable.toLocaleString()} AED</span></div>
        </div>
      </body>
    </html>
  `;

  const handleDownloadPDF = async () => {
    try {
      const html = generatePayslipHTML();
      await Print.printToFileAsync({ html });
      Alert.alert('Download PDF', `Payslip PDF generated successfully: Payslip_${userUniqueId.replace('#', '')}_August_2026.pdf`);
    } catch (error) {
      console.log('PDF generation failed', error);
      Alert.alert('Error', 'Failed to generate PDF payslip.');
    }
  };

  const handleShare = async () => {
    try {
      const html = generatePayslipHTML();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Payslip_${userUniqueId.replace('#', '')}_August_2026.pdf`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Error', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.log('Sharing failed', error);
      Alert.alert('Error', 'Failed to share payslip document.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction: currentLang === 'ar' ? 'rtl' : 'ltr' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{t.back || 'Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.payslips || 'Payslips & Earnings'}</Text>
        </View>

        <View style={[styles.statusBadge, payslipStatus === 'Verified' ? styles.approvedBadge : styles.pendingBadge]}>
          <Text style={styles.statusBadgeText}>
            {payslipStatus === 'Verified' ? 'Manager Verified Payslip' : `Payslip Status: ${payslipStatus}`}
          </Text>
        </View>

        {auditInfo && (
          <View style={styles.auditBanner}>
            <Text style={styles.auditText}>{auditInfo}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.monthlySummary || 'Monthly Salary Summary'}</Text>
          <Text style={styles.rateSubText}>
            {t.portalTitle || 'Propaganda Portal'} <Text style={styles.idHighlightText}>ID: {userUniqueId}</Text>
          </Text>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Gross Salary:</Text>
            <Text style={styles.breakdownValue}>{grossSalary.toLocaleString()} AED</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Total Deductions:</Text>
            <Text style={styles.breakdownValueRed}>-{totalDeductions.toLocaleString()} AED</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.breakdownRow}>
            <Text style={styles.totalLabel}>{t.netPayable || 'Net Payable:'}</Text>
            <Text style={styles.totalValue}>{netPayable.toLocaleString()} AED</Text>
          </View>

          <View style={styles.iconActionRow}>
            <TouchableOpacity style={styles.iconButton} onPress={handleDownloadPDF}>
              <Text style={styles.iconButtonText}>{t.download || 'Download'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
              <Text style={styles.iconButtonText}>{t.share || 'Share'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => setDetailsModalVisible(true)}>
              <Text style={styles.iconButtonText}>{t.viewDetails || 'Details'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Check-In Logs</Text>
          {logs.length === 0 ? (
            <Text style={styles.noLogsText}>No attendance records found.</Text>
          ) : (
            logs.slice(0, 5).map((log, index) => (
              <View key={index} style={styles.logItem}>
                <View>
                  <Text style={styles.logDateText}>{formatLogDate(log.checkIn)}</Text>
                  <Text style={styles.logSubText}>Duration: {log.hoursWorked} hrs</Text>
                </View>
                <Text style={styles.logPayText}>+{log.earnings} AED</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Full Details Modal */}
      <Modal animationType="slide" transparent={true} visible={detailsModalVisible} onRequestClose={() => setDetailsModalVisible(false)}>
        <View style={styles.modaloverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Full Payslip Details (August 2026)</Text>
              <TouchableOpacity style={styles.closeIconBtn} onPress={() => setDetailsModalVisible(false)}>
                <Text style={styles.closeIconText}>X</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.modalSectionHeader}>Employee Information</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Name:</Text>
                <Text style={styles.breakdownValue}>{userName}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>ID:</Text>
                <Text style={styles.breakdownValue}>{userUniqueId}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Email:</Text>
                <Text style={styles.breakdownValue}>{userEmail}</Text>
              </View>

              <View style={styles.divider} />
              <Text style={styles.modalSectionHeader}>Earnings & Allowances</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Basic Salary:</Text>
                <Text style={styles.breakdownValue}>AED {basicSalary.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Housing Allowance:</Text>
                <Text style={styles.breakdownValue}>AED {housingAllowance.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Transport Allowance:</Text>
                <Text style={styles.breakdownValue}>AED {transportAllowance.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Overtime Pay:</Text>
                <Text style={styles.breakdownValueGreen}>+ AED {overtimePay.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelBold}>Gross Salary:</Text>
                <Text style={styles.breakdownValueBold}>AED {grossSalary.toLocaleString()}</Text>
              </View>

              <View style={styles.divider} />
              <Text style={styles.modalSectionHeader}>Deductions</Text>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Late Penalties & Absences:</Text>
                <Text style={styles.breakdownValueRed}>- AED {latePenalties.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Loan Repayment:</Text>
                <Text style={styles.breakdownValueRed}>- AED {loans.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Health Insurance:</Text>
                <Text style={styles.breakdownValueRed}>- AED {insurance.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelBold}>Total Deductions:</Text>
                <Text style={styles.breakdownValueRedBold}>- AED {totalDeductions.toLocaleString()}</Text>
              </View>

              <View style={styles.finalNetBoxModal}>
                <Text style={styles.finalNetLabelModal}>FINAL NET PAYABLE</Text>
                <Text style={styles.finalNetValueModal}>AED {netPayable.toLocaleString()}</Text>
                <Text style={styles.payDateModal}>Payment Date: {paymentDate}</Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.closeMenuButton} onPress={() => setDetailsModalVisible(false)}>
              <Text style={styles.closeMenuButtonText}>Close Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  statusBadge: { width: '100%', maxWidth: 550, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  approvedBadge: { backgroundColor: '#0d9488' },
  pendingBadge: { backgroundColor: '#08898b' },
  statusBadgeText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  auditBanner: { width: '100%', maxWidth: 550, backgroundColor: '#1e293b', padding: 8, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  auditText: { color: '#38bdf8', fontSize: 12, fontStyle: 'italic' },
  card: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  rateSubText: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  idHighlightText: { color: '#2b5267', fontWeight: 'bold' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  breakdownLabel: { fontSize: 15, color: '#475569' },
  breakdownLabelBold: { fontSize: 15, color: '#0f172a', fontWeight: 'bold' },
  breakdownValue: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  breakdownValueBold: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  breakdownValueGreen: { fontSize: 15, fontWeight: '600', color: '#0d9488' },
  breakdownValueRed: { fontSize: 15, fontWeight: '600', color: '#dc2626' },
  breakdownValueRedBold: { fontSize: 15, fontWeight: 'bold', color: '#dc2626' },
  divider: { height: 1, backgroundColor: '#cbd5e1', marginVertical: 12 },
  totalLabel: { fontSize: 17, fontWeight: 'bold', color: '#0f172a' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: '#0d9488' },
  iconActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 16, gap: 10 },
  iconButton: { flex: 1, backgroundColor: '#e2e8f0', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  iconButtonText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a' },
  noLogsText: { fontSize: 14, color: '#64748b', fontStyle: 'italic', marginTop: 8 },
  logItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  logDateText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  logSubText: { fontSize: 12, color: '#64748b', marginTop: 2 },
  logPayText: { fontSize: 15, fontWeight: 'bold', color: '#0d9488' },
  modaloverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: '#12202a', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1e3a4c' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e3a4c', paddingBottom: 16, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e3a4c', justifyContent: 'center', alignItems: 'center' },
  closeIconText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  modalScroll: { maxHeight: 420, marginBottom: 16 },
  modalSectionHeader: { fontSize: 14, fontWeight: 'bold', color: '#38bdf8', marginTop: 8, marginBottom: 4 },
  finalNetBoxModal: { backgroundColor: '#064e3b', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#059669' },
  finalNetLabelModal: { color: '#6ee7b7', fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  finalNetValueModal: { fontWeight: 'bold', color: '#ffffff', fontSize: 18, marginBottom: 4 },
  payDateModal: { color: '#a7f3d0', fontSize: 12, fontStyle: 'italic' },
  closeMenuButton: { backgroundColor: '#2b5267', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeMenuButtonText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', letterSpacing: 0.5 },
});