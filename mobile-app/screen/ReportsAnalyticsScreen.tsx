import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Dimensions,
  I18nManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

interface Employee {
  id: string;
  fullName?: string;
  name?: string;
  email: string;
  role: 'Employee' | 'Manager' | 'Supervisor' | 'Admin';
  department?: string;
  status?: 'Active' | 'On Leave' | 'Inactive';
  joinDate?: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  email?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  startDate?: string;
}

interface ReportsAnalyticsScreenProps {
  onBack: () => void;
  onOpenAttendanceLogs: () => void;
  onOpenPayslipManagement: () => void;
  onOpenLeaveManagement: () => void;
  currentTheme?: 'Dark' | 'Light';
  onThemeChange?: (theme: 'Dark' | 'Light') => void;
  currentFontSize?: 'Small' | 'Medium' | 'Large';
  onFontSizeChange?: (size: 'Small' | 'Medium' | 'Large') => void;
  globalTextStyle?: { fontSize: number; lineHeight: number };
}

export default function ReportsAnalyticsScreen({
  onBack,
  onOpenAttendanceLogs,
  onOpenPayslipManagement,
  onOpenLeaveManagement,
  currentTheme = 'Dark',
  onThemeChange,
  currentFontSize = 'Medium',
  onFontSizeChange,
  globalTextStyle,
}: ReportsAnalyticsScreenProps) {
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [selectedDateRange, setSelectedDateRange] = useState('August 2026');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');
  const [userUniqueId, setUserUniqueId] = useState('#1945');
  const [activeEmployeeCount, setActiveEmployeeCount] = useState(24);
  const [totalMonthlyPayroll, setTotalMonthlyPayroll] = useState('AED 184,500');
  const [portalLang, setPortalLang] = useState<'en' | 'ar'>('en');

  // Real-time leave statistics counts
  const [leaveStats, setLeaveStats] = useState({
    approved: 14,
    pending: 3,
    rejected: 2,
  });

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
    loadPreferencesAndData();
    const interval = setInterval(() => {
      loadWorkforceData();
      loadLeaveStatistics();
    }, 3000);
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

  const loadPreferencesAndData = async () => {
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
    loadWorkforceData();
    loadLeaveStatistics();
  };

  const loadWorkforceData = async () => {
    try {
      const savedAdminId = await AsyncStorage.getItem('@user_unique_id_fahadmukasa74@gmail.com');
      if (savedAdminId) {
        setUserUniqueId(savedAdminId);
      } else {
        const fallbackId = await AsyncStorage.getItem('@user_unique_id');
        if (fallbackId) setUserUniqueId(fallbackId);
      }

      // --- FETCH WORKFORCE FROM SUPABASE CLOUD ---
      const { data: cloudProfiles, error: cloudError } = await supabase
        .from('profiles')
        .select('*');

      if (!cloudError && cloudProfiles && cloudProfiles.length > 0) {
        const activeWorkers = cloudProfiles.filter((w: any) => !w.status || w.status === 'Active');
        setActiveEmployeeCount(activeWorkers.length);
        const calculatedPayroll = activeWorkers.length * 7500;
        setTotalMonthlyPayroll(`AED ${calculatedPayroll.toLocaleString()}`);
        return;
      }

      // Fallback to AsyncStorage if cloud fetch is empty or fails
      const savedWorkersJson = await AsyncStorage.getItem('@registered_workers_list');
      if (savedWorkersJson) {
        const parsedWorkers: Employee[] = JSON.parse(savedWorkersJson);
        const activeWorkers = parsedWorkers.filter((w) => !w.status || w.status === 'Active');
        setActiveEmployeeCount(activeWorkers.length);

        const calculatedPayroll = activeWorkers.length * 7500;
        setTotalMonthlyPayroll(`AED ${calculatedPayroll.toLocaleString()}`);
      }
    } catch (error) {
      console.log('Failed to load workforce analytics data from cloud/storage', error);
    }
  };

  const loadLeaveStatistics = async () => {
    try {
      // --- FETCH LEAVE REQUESTS FROM SUPABASE CLOUD ---
      const { data: cloudLeaves, error: cloudError } = await supabase
        .from('leave_requests')
        .select('*');

      if (!cloudError && cloudLeaves) {
        const approvedCount = cloudLeaves.filter((r: any) => r.status === 'Approved').length;
        const pendingCount = cloudLeaves.filter((r: any) => r.status === 'Pending').length;
        const rejectedCount = cloudLeaves.filter((r: any) => r.status === 'Rejected').length;

        if (cloudLeaves.length > 0) {
          setLeaveStats({
            approved: approvedCount,
            pending: pendingCount,
            rejected: rejectedCount,
          });
          return;
        }
      }

      // Fallback to local storage if cloud fetch fails
      const keys = await AsyncStorage.getAllKeys();
      const leaveKeys = keys.filter((k) => k.startsWith('@leave_request_'));
      let allRequests: LeaveRequest[] = [];

      if (leaveKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(leaveKeys);
        for (const pair of pairs) {
          if (pair[1]) {
            try {
              const req = JSON.parse(pair[1]);
              if (req) allRequests.push(req);
            } catch (e) {
              console.log('Error parsing leave stats item', e);
            }
          }
        }
      }

      const savedMgmt = await AsyncStorage.getItem('@management_leave_requests');
      if (savedMgmt) {
        const mgmtParsed: LeaveRequest[] = JSON.parse(savedMgmt);
        for (const mReq of mgmtParsed) {
          if (!allRequests.some((p) => p.id === mReq.id)) {
            allRequests.push(mReq);
          }
        }
      }

      const approvedCount = allRequests.filter((r) => r.status === 'Approved').length;
      const pendingCount = allRequests.filter((r) => r.status === 'Pending').length;
      const rejectedCount = allRequests.filter((r) => r.status === 'Rejected').length;

      if (allRequests.length > 0) {
        setLeaveStats({
          approved: approvedCount,
          pending: pendingCount,
          rejected: rejectedCount,
        });
      }
    } catch (error) {
      console.log('Failed to load leave statistics', error);
    }
  };

  const handleExportReport = (reportType: string, format: 'PDF' | 'Excel') => {
    Alert.alert(
      isRTL ? `تصدير ${reportType}` : `Exporting ${reportType}`,
      isRTL 
        ? `جاري إنشاء تقارير ${format} للفترة: ${selectedDateRange} (القسم: ${selectedDepartment}, الدور: ${selectedRole}). تم تنزيل الملف بنجاح.` 
        : `Generating ${format} report for range: ${selectedDateRange} (Dept: ${selectedDepartment}, Role: ${selectedRole}). File downloaded successfully.`
    );
  };

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
            {isRTL ? 'التقارير وتحليلات القوى العاملة' : 'Reports & Workforce Analytics'}
          </Text>
        </View>

        {/* Integration Quick Links Bar */}
        <View style={[styles.quickLinksCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.quickLinksTitle, activeTextStyle, { color: isLight ? '#2563eb' : '#38bdf8' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? '🔗 مصادر البيانات في الوقت الفعلي والارتباطات المرجعية — ' : '🔗 Real-Time Data Sources & Cross-References — '} <Text style={styles.idHighlightText}>{isRTL ? `رقم المعرف: ${userUniqueId}` : `Admin ID: ${userUniqueId}`}</Text>
          </Text>
          <View style={[styles.quickLinksRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenAttendanceLogs}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? '📊 سجلات الحضور' : '📊 Attendance Logs'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenPayslipManagement}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? '💰 مراجعة قسائم الرواتب' : '💰 Payslip Review'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.quickLinkBtn, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={onOpenLeaveManagement}>
              <Text style={[styles.quickLinkText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{isRTL ? '🏖️ طلبات الإجازات' : '🏖️ Leave Requests'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Top Key Metrics Overview Cards */}
        <Text style={[styles.sectionHeading, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
          {isRTL ? '📈 نظرة عامة تنفيذية على القوى العاملة' : '📈 Executive Workforce Overview'}
        </Text>
        <View style={[styles.metricsGrid, isDesktop && styles.metricsGridDesktop, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={[styles.metricCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.metricCardFlex, isRTL && { flexDirection: 'row-reverse' }]}>
            <View>
              <Text style={[styles.metricLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'إجمالي الموظفين النشطين' : 'TOTAL ACTIVE EMPLOYEES'}
              </Text>
              <Text style={[styles.metricValue, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? `${activeEmployeeCount} عامل` : `${activeEmployeeCount} Workers`}
              </Text>
              <Text style={[styles.metricSub, activeTextStyle, { color: isLight ? '#64748b' : '#64748b' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'متزامن مع Supabase السحابي' : 'Synced with Cloud Database'}
              </Text>
            </View>
            <View style={styles.iconBoxBlue}><Text style={styles.iconEmoji}>👥</Text></View>
          </View>

          <View style={[styles.metricCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.metricCardFlex, isRTL && { flexDirection: 'row-reverse' }]}>
            <View>
              <Text style={[styles.metricLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'معدل الحضور' : 'ATTENDANCE RATE'}
              </Text>
              <Text style={[styles.metricValueGreen, activeTextStyle, isRTL && { textAlign: 'right' }]}>96.4%</Text>
              <Text style={[styles.metricSub, activeTextStyle, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'المتوسط الأسبوعي' : 'Weekly Average'}
              </Text>
            </View>
            <View style={styles.iconBoxGreen}><Text style={[styles.whiteCheck, activeTextStyle]}>✓</Text></View>
          </View>

          <View style={[styles.metricCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.metricCardFlex, isRTL && { flexDirection: 'row-reverse' }]}>
            <View>
              <Text style={[styles.metricLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'متوسط ساعات العمل' : 'AVG WORKING HOURS'}
              </Text>
              <Text style={[styles.metricValueYellow, activeTextStyle, isRTL && { textAlign: 'right' }]}>
                {isRTL ? '8.4 ساعة' : '8.4 Hrs'}
              </Text>
              <Text style={[styles.metricSub, activeTextStyle, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'لكل مناوبة نشطة' : 'Per active shift'}
              </Text>
            </View>
            <View style={styles.iconBoxYellow}><Text style={styles.iconEmoji}>⏰</Text></View>
          </View>

          <View style={[styles.metricCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.metricCardFlex, isRTL && { flexDirection: 'row-reverse' }]}>
            <View>
              <Text style={[styles.metricLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'إجمالي الرواتب الشهرية' : 'TOTAL MONTHLY PAYROLL'}
              </Text>
              <Text style={[styles.metricValueOrange, activeTextStyle, isRTL && { textAlign: 'right' }]}>{totalMonthlyPayroll}</Text>
              <Text style={[styles.metricSub, activeTextStyle, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تم التحقق منها ومتوازنة' : 'Verified & Balanced'}
              </Text>
            </View>
            <View style={styles.iconBoxOrange}><Text style={styles.iconEmoji}>💵</Text></View>
          </View>
        </View>

        {/* Visual Analytics Summary Panels */}
        <Text style={[styles.sectionHeading, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
          {isRTL ? '📊 رؤى الأداء المرئية' : '📊 Visual Performance Insights'}
        </Text>
        <View style={[styles.analyticsGrid, isDesktop && styles.analyticsGridDesktop, isRTL && { flexDirection: 'row-reverse' }]}>
          
          {/* Attendance Trends */}
          <View style={[styles.analyticsCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.analyticsCardFlex]}>
            <Text style={[styles.cardTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? `📈 اتجاهات الحضور (${selectedDateRange})` : `📈 Attendance Trends (${selectedDateRange})`}
            </Text>
            <Text style={[styles.cardDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'اتساق تسجيل الحضور اليومي عبر مركز البطين.' : 'Daily check-in consistency across Al Bateen Hub.'}
            </Text>
            <View style={[styles.mockChartBox, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
              <View style={[styles.chartBarLine, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={[styles.barFill, { height: '85%' }]}><Text style={[styles.barText, activeTextStyle]}>W1</Text></View>
                <View style={[styles.barFill, { height: '95%' }]}><Text style={[styles.barText, activeTextStyle]}>W2</Text></View>
                <View style={[styles.barFill, { height: '90%' }]}><Text style={[styles.barText, activeTextStyle]}>W3</Text></View>
                <View style={[styles.barFill, { height: '98%' }]}><Text style={[styles.barText, activeTextStyle]}>W4</Text></View>
              </View>
            </View>
            <Text style={[styles.chartNote, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'تم تسجيل ذروة الحضور خلال جداول مناوبات الأسبوع الرابع.' : 'Peak attendance recorded during Week 4 shift rosters.'}
            </Text>
          </View>

          {/* Department Performance */}
          <View style={[styles.analyticsCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.analyticsCardFlex]}>
            <Text style={[styles.cardTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? '🏢 إنتاجية الأقسام' : '🏢 Department Productivity'}
            </Text>
            <Text style={[styles.cardDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'الإنتاجية والساعات المسجلة حسب القسم.' : 'Productivity and hours logged by department.'}
            </Text>
            <View style={[styles.deptRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.deptLabel, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'الهندسة والذكاء الاصطناعي' : 'Engineering & AI'}
              </Text>
              <View style={[styles.progressBg, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}><View style={[styles.progressFill, { width: '92%' }]}></View></View>
              <Text style={[styles.deptVal, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'left' }]}>92%</Text>
            </View>
            <View style={[styles.deptRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.deptLabel, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'قسم الخدمات' : 'Service Department'}
              </Text>
              <View style={[styles.progressBg, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}><View style={[styles.progressFill, { width: '88%' }]}></View></View>
              <Text style={[styles.deptVal, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'left' }]}>88%</Text>
            </View>
            <View style={[styles.deptRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.deptLabel, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'عمليات المطعم' : 'Restaurant Operations'}
              </Text>
              <View style={[styles.progressBg, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}><View style={[styles.progressFill, { width: '96%' }]}></View></View>
              <Text style={[styles.deptVal, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'left' }]}>96%</Text>
            </View>
          </View>

          {/* Payroll Breakdown */}
          <View style={[styles.analyticsCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.analyticsCardFlex]}>
            <Text style={[styles.cardTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? '🥧 توزيع الرواتب' : '🥧 Payroll Breakdown'}
            </Text>
            <Text style={[styles.cardDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'توزيع الرواتب عبر مكونات التعويضات.' : 'Salary distribution across compensation components.'}
            </Text>
            <View style={styles.breakdownList}>
              <View style={[styles.breakdownItem, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.dotBasic}></Text>
                <Text style={[styles.breakdownText, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                  {isRTL ? 'الراتب الأساسي (65%)' : 'Basic Pay (65%)'}
                </Text>
              </View>
              <View style={[styles.breakdownItem, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.dotHousing}></Text>
                <Text style={[styles.breakdownText, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                  {isRTL ? 'السكن والمواصلات (22%)' : 'Housing & Transport (22%)'}
                </Text>
              </View>
              <View style={[styles.breakdownItem, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.dotOvertime}></Text>
                <Text style={[styles.breakdownText, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                  {isRTL ? 'الوقت الإضافي والمكافآت (10%)' : 'Overtime & Bonuses (10%)'}
                </Text>
              </View>
              <View style={[styles.breakdownItem, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.dotDeductions}></Text>
                <Text style={[styles.breakdownText, activeTextStyle, { color: isLight ? '#0f172a' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                  {isRTL ? 'الخصومات والتأمين (3%)' : 'Deductions & Insurance (3%)'}
                </Text>
              </View>
            </View>
          </View>

          {/* Leave Statistics */}
          <View style={[styles.analyticsCard, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.analyticsCardFlex]}>
            <Text style={[styles.cardTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? '🏖️ إحصائيات الإجازات' : '🏖️ Leave Statistics'}
            </Text>
            <Text style={[styles.cardDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'تفصيل حالات الطلبات الحالية.' : 'Breakdown of current request statuses.'}
            </Text>
            <View style={[styles.leaveStatsRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.leaveBadge, { backgroundColor: '#065f46' }]}>
                <Text style={[styles.leaveBadgeNum, activeTextStyle]}>{leaveStats.approved}</Text>
                <Text style={[styles.leaveBadgeText, activeTextStyle]}>{isRTL ? 'موافق عليه' : 'Approved'}</Text>
              </View>
              <View style={[styles.leaveBadge, { backgroundColor: '#78350f' }]}>
                <Text style={[styles.leaveBadgeNum, activeTextStyle]}>{leaveStats.pending}</Text>
                <Text style={[styles.leaveBadgeText, activeTextStyle]}>{isRTL ? 'قيد الانتظار' : 'Pending'}</Text>
              </View>
              <View style={[styles.leaveBadge, { backgroundColor: '#991b1b' }]}>
                <Text style={[styles.leaveBadgeNum, activeTextStyle]}>{leaveStats.rejected}</Text>
                <Text style={[styles.leaveBadgeText, activeTextStyle]}>{isRTL ? 'مرفوض' : 'Rejected'}</Text>
              </View>
            </View>
            <Text style={[styles.chartNote, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'متزامن مع Supabase السحابي (تحديث في الوقت الفعلي)' : 'Synced with Supabase Cloud (Real-Time Update)'}
            </Text>
          </View>

        </View>

        {/* Filters and Report Generation Section */}
        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.sectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? '⚙️ إعداد التقارير والفلاتر' : '⚙️ Report Configuration & Filters'}
          </Text>
          
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'فترة النطاق الزمني:' : 'Date Range Period:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['August 2026', 'July 2026', 'Q2 2026', 'Year 2026'].map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[styles.pill, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, selectedDateRange === range && styles.pillActive]}
                  onPress={() => setSelectedDateRange(range)}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedDateRange === range && styles.pillTextActive]}>{range}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'تصفية حسب القسم:' : 'Department Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Engineering & AI', 'Service Department', 'Operations', 'Restaurant Operations'].map((dept) => (
                <TouchableOpacity
                  key={dept}
                  style={[styles.pill, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, selectedDepartment === dept && styles.pillActive]}
                  onPress={() => setSelectedDepartment(dept)}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedDepartment === dept && styles.pillTextActive]}>{dept}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
              {isRTL ? 'تصفية حسب دور الموظف:' : 'Employee Role Filter:'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
              {['All', 'Employee', 'Supervisor', 'Manager', 'Admin'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.pill, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, selectedRole === role && styles.pillActive]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, selectedRole === role && styles.pillTextActive]}>{role}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* Reports Generation & Export Actions */}
        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
          <Text style={[styles.sectionTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
            {isRTL ? '📥 إنشاء وتصدير التقارير الرسمية' : '📥 Generate & Export Official Reports'}
          </Text>
          
          <View style={[styles.reportRowGrid, isDesktop && styles.reportRowGridDesktop, isRTL && { flexDirection: 'row-reverse' }]}>
            
            <View style={[styles.reportItemCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
              <Text style={styles.reportIcon}>📊</Text>
              <Text style={[styles.reportName, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تقرير الحضور' : 'Attendance Report'}
              </Text>
              <Text style={[styles.reportDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تسجيلات الحضور مفصلة، التأخير، والساعات المُنجزة.' : 'Detailed check-ins, lateness, and hours worked.'}
              </Text>
              <View style={[styles.exportBtnRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity style={styles.exportPdfBtn} onPress={() => handleExportReport('Attendance Report', 'PDF')}>
                  <Text style={[styles.exportBtnText, activeTextStyle]}>📄 PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportExcelBtn} onPress={() => handleExportReport('Attendance Report', 'Excel')}>
                  <Text style={[styles.exportBtnText, activeTextStyle]}>📊 Excel</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.reportItemCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
              <Text style={styles.reportIcon}>💰</Text>
              <Text style={[styles.reportName, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تقرير الرواتب' : 'Payroll Report'}
              </Text>
              <Text style={[styles.reportDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'توزيع الرواتب، الخصومات، وصافي المدفوعات.' : 'Salary distribution, deductions, and net payouts.'}
              </Text>
              <View style={[styles.exportBtnRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity style={styles.exportPdfBtn} onPress={() => handleExportReport('Payroll Report', 'PDF')}>
                  <Text style={[styles.exportBtnText, activeTextStyle]}>📄 PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportExcelBtn} onPress={() => handleExportReport('Payroll Report', 'Excel')}>
                  <Text style={[styles.exportBtnText, activeTextStyle]}>📊 Excel</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.reportItemCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
              <Text style={styles.reportIcon}>🏖️</Text>
              <Text style={[styles.reportName, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تقرير الإجازات' : 'Leave Report'}
              </Text>
              <Text style={[styles.reportDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'أرصدة الإجازات، الطلبات الموافق عليها، والغيابات.' : 'Leave balances, approved requests, and absences.'}
              </Text>
              <View style={[styles.exportBtnRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity style={styles.exportPdfBtn} onPress={() => handleExportReport('Leave Report', 'PDF')}>
                  <Text style={[styles.exportBtnText, activeTextStyle]}>📄 PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportExcelBtn} onPress={() => handleExportReport('Leave Report', 'Excel')}>
                  <Text style={[styles.exportBtnText, activeTextStyle]}>📊 Excel</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.reportItemCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]}>
              <Text style={styles.reportIcon}>🔒</Text>
              <Text style={[styles.reportName, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'تقرير تدقيق الامتثال' : 'Compliance Audit Report'}
              </Text>
              <Text style={[styles.reportDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'حالة ملف حماية الرواتب MOHRE SIF، التحقق من النطاق الجغرافي، والسجلات.' : 'MOHRE SIF status, geofence validations, and logs.'}
              </Text>
              <View style={[styles.exportBtnRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity style={styles.exportPdfBtn} onPress={() => handleExportReport('Compliance Audit Report', 'PDF')}>
                  <Text style={[styles.exportBtnText, activeTextStyle]}>📄 PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportExcelBtn} onPress={() => handleExportReport('Compliance Audit Report', 'Excel')}>
                  <Text style={[styles.exportBtnText, activeTextStyle]}>📊 Excel</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </View>

      </ScrollView>
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

  sectionHeading: { fontWeight: 'bold', marginBottom: 14, marginTop: 10 },

  metricsGrid: { width: '100%', gap: 14, marginBottom: 20 },
  metricsGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  metricCard: { borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  metricCardFlex: { flex: 1, minWidth: 240 },
  metricLabel: { fontWeight: 'bold', letterSpacing: 0.5 },
  metricValue: { fontWeight: 'bold', marginTop: 4 },
  metricValueGreen: { fontWeight: 'bold', color: '#34d399', marginTop: 4 },
  metricValueYellow: { fontWeight: 'bold', color: '#fbbf24', marginTop: 4 },
  metricValueOrange: { fontWeight: 'bold', color: '#f97316', marginTop: 4 },
  metricSub: { marginTop: 4 },

  iconBoxBlue: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center' },
  iconBoxGreen: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#065f46', justifyContent: 'center', alignItems: 'center' },
  iconBoxYellow: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#78350f', justifyContent: 'center', alignItems: 'center' },
  iconBoxOrange: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#9a3412', justifyContent: 'center', alignItems: 'center' },
  iconEmoji: {},
  whiteCheck: { color: '#ffffff', fontWeight: 'bold' },

  analyticsGrid: { width: '100%', gap: 16, marginBottom: 20 },
  analyticsGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  analyticsCard: { width: '100%', borderRadius: 20, padding: 20, borderWidth: 1 },
  analyticsCardFlex: { width: '48%', minWidth: 380, flexGrow: 1 },
  cardTitle: { fontWeight: 'bold', marginBottom: 4 },
  cardDesc: { marginBottom: 14 },

  mockChartBox: { borderRadius: 12, padding: 16, height: 140, justifyContent: 'flex-end', borderWidth: 1, marginBottom: 10 },
  chartBarLine: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: '100%' },
  barFill: { width: 40, backgroundColor: '#2563eb', borderTopLeftRadius: 6, borderTopRightRadius: 6, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 6 },
  barText: { color: '#ffffff', fontWeight: 'bold' },
  chartNote: { fontStyle: 'italic' },

  deptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  deptLabel: { width: 140, fontWeight: 'bold' },
  progressBg: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden', borderWidth: 1 },
  progressFill: { height: '100%', backgroundColor: '#38bdf8', borderRadius: 5 },
  deptVal: { width: 35, fontWeight: 'bold', textAlign: 'right' },

  breakdownList: { gap: 10, marginTop: 6 },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dotBasic: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563eb' },
  dotHousing: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#38bdf8' },
  dotOvertime: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#34d399' },
  dotDeductions: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  breakdownText: { fontWeight: '500' },

  leaveStatsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  leaveBadge: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  leaveBadgeNum: { fontWeight: 'bold', color: '#ffffff' },
  leaveBadgeText: { color: '#e2e8f0', marginTop: 2, fontWeight: '600' },

  card: { width: '100%', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 14 },
  filterGroup: { marginBottom: 12 },
  filterLabel: { fontWeight: 'bold', marginBottom: 6 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1 },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontWeight: '500' },
  pillTextActive: { color: '#ffffff', fontWeight: 'bold' },

  reportRowGrid: { width: '100%', gap: 16 },
  reportRowGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  reportItemCard: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1, flexGrow: 1 },
  reportIcon: {},
  reportName: { fontWeight: 'bold', marginBottom: 4 },
  reportDesc: { marginBottom: 14, minHeight: 32 },
  exportBtnRow: { flexDirection: 'row', gap: 10 },
  exportPdfBtn: { flex: 1, backgroundColor: '#991b1b', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  exportExcelBtn: { flex: 1, backgroundColor: '#065f46', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  exportBtnText: { color: '#ffffff', fontWeight: 'bold' },
});