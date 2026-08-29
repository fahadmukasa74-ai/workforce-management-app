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
  Alert,
  Dimensions,
  I18nManager,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabaseClient';
import EmployeeOverviewScreen from './EmployeeOverviewScreen';
import ProfileScreen from './ProfileScreen';
import enTranslations from '../lang/en.json';
import arTranslations from '../lang/ar.json';

const translationsMap = {
  en: enTranslations,
  ar: arTranslations,
};

interface ManagementDashboardProps {
  onLogout: () => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
  onOpenPayslips?: () => void;
  onOpenPayslipManagement?: () => void;
  onOpenLeave?: () => void;
  onOpenLeaveManagement?: () => void;
  onOpenShifts?: () => void;
  onOpenShiftManagement?: () => void;
  onOpenAttendance?: () => void;
  onOpenAttendanceLogs?: () => void;
  onOpenEmployeeOverview?: () => void;
  onOpenReportsAnalytics?: () => void;
  onOpenExpenseClaims?: () => void;
  onOpenAnnouncementsManagement?: () => void;
  onViewProfile?: (employeeId: string, employeeEmail?: string) => void;
  userName: string;
  userRole: string;
  currentTheme?: 'Dark' | 'Light';
  onThemeChange?: (theme: 'Dark' | 'Light') => void;
  currentFontSize?: 'Small' | 'Medium' | 'Large';
  onFontSizeChange?: (size: 'Small' | 'Medium' | 'Large') => void;
  globalTextStyle?: { fontSize: number; lineHeight: number };
}

interface AttendanceLog {
  id?: string;
  employeeId?: string;
  employeeName?: string;
  checkIn: string | number;
  checkOut: string | number | null;
  hoursWorked?: number;
  totalHours?: string;
  earnings?: number;
  status: string;
  date?: string;
  gpsLocation?: string;
}

interface RegisteredWorker {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone: string;
  location: string;
  coordinates: string;
  status?: 'Active' | 'On Leave' | 'Inactive';
}

interface SelectedMediaFile {
  uri: string;
  type: 'image' | 'video';
}

export default function ManagementDashboard({
  onLogout,
  onOpenSettings,
  onOpenProfile,
  onOpenPayslips,
  onOpenPayslipManagement,
  onOpenLeave,
  onOpenLeaveManagement,
  onOpenShifts,
  onOpenShiftManagement,
  onOpenAttendance,
  onOpenAttendanceLogs,
  onOpenEmployeeOverview,
  onOpenReportsAnalytics,
  onOpenExpenseClaims,
  onOpenAnnouncementsManagement,
  onViewProfile,
  userName,
  userRole,
  currentTheme = 'Dark',
  onThemeChange,
  currentFontSize = 'Medium',
  onFontSizeChange,
  globalTextStyle,
}: ManagementDashboardProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [geofenceRadius, setGeofenceRadius] = useState('200');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [portalLang, setPortalLang] = useState<'en' | 'ar'>('en');

  // Live Metrics States
  const [totalActiveRoster, setTotalActiveRoster] = useState<number>(0);
  const [registeredWorkersCount, setRegisteredWorkersCount] = useState<number>(0);
  const [wpsStatus, setWpsStatus] = useState<string>('Fully Completed');

  // New Worker Registration Modal States
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerEmail, setNewWorkerEmail] = useState('');
  const [newWorkerPhone, setNewWorkerPhone] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState('Employee');
  const [registeredWorkers, setRegisteredWorkers] = useState<RegisteredWorker[]>([]);

  // Announcement Broadcast Modal States with Media Support & Removal
  const [announcementModalVisible, setAnnouncementModalVisible] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaFile[]>([]);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  // Profile Modal State for Admin Viewing Employee Details & UAE ID Documents
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedProfileEmail, setSelectedProfileEmail] = useState<string | null>(null);

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
    loadPreferencesAndManagementData();
    const interval = setInterval(loadManagementData, 3000);
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

  const loadPreferencesAndManagementData = async () => {
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
    loadManagementData();
  };

  const loadManagementData = async () => {
    try {
      const savedGlobalLogs = await AsyncStorage.getItem('@global_attendance_logs');
      const resolvedAdminImage = await AsyncStorage.getItem('@profile_image_fahadmukasa74@gmail.com');
      const savedWps = await AsyncStorage.getItem('@mohre_wps_status');

      if (savedGlobalLogs) {
        setLogs(JSON.parse(savedGlobalLogs));
      }

      if (resolvedAdminImage && !resolvedAdminImage.startsWith('blob:')) {
        setProfileImage(resolvedAdminImage);
      } else {
        setProfileImage(null);
      }

      if (savedWps) {
        setWpsStatus(savedWps);
      }

      let workersList: RegisteredWorker[] = [];
      try {
        const { data: cloudWorkers, error: cloudError } = await supabase.from('workers').select('*');
        if (!cloudError && cloudWorkers && cloudWorkers.length > 0) {
          workersList = cloudWorkers.map((w: any) => ({
            id: w.id || '#1945',
            fullName: w.full_name || w.fullName || 'Staff Member',
            email: w.email || '',
            role: w.role || 'Employee',
            phone: w.phone || '+971 50 000 0000',
            location: w.location || 'Al Bateen Hub',
            coordinates: w.coordinates || '24.456338, 54.354812',
            status: w.status || 'Active',
          }));
        }
      } catch (networkErr) {
        // Suppress network errors
      }

      if (workersList.length === 0) {
        const savedWorkers = await AsyncStorage.getItem('@registered_workers_list');
        if (savedWorkers) {
          workersList = JSON.parse(savedWorkers);
        } else {
          workersList = [
            {
              id: '#1945',
              fullName: 'FAHAD MUKASA',
              email: 'fahadmukasa74@gmail.com',
              role: 'Admin',
              phone: '+971 50 000 0000',
              location: 'Al Bateen Hub',
              coordinates: '24.456338, 54.354812',
              status: 'Active',
            },
          ];
          await AsyncStorage.setItem('@registered_workers_list', JSON.stringify(workersList));
        }
      }

      setRegisteredWorkers(workersList);
      setRegisteredWorkersCount(workersList.length);

      const activeCount = workersList.filter((w) => !w.status || w.status === 'Active').length;
      setTotalActiveRoster(activeCount);
    } catch (error) {
      // Gracefully catch errors
    }
  };

  const generateEmployeeID = (existingWorkers: RegisteredWorker[]): string => {
    const min = 1945;
    const max = 9236;
    let uniqueId = '';
    let attempts = 0;
    while (attempts < 1000) {
      const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
      const candidateId = `#${randomNum}`;
      const exists = existingWorkers.some((w) => w.id === candidateId);
      if (!exists) {
        uniqueId = candidateId;
        break;
      }
      attempts++;
    }
    if (!uniqueId) {
      uniqueId = `#${Math.floor(1945 + Math.random() * 7291)}`;
    }
    return uniqueId;
  };

  const handleSaveNewWorker = async () => {
    if (!newWorkerName.trim() || !newWorkerEmail.trim()) {
      Alert.alert('Validation Error', 'Please enter both full name and email address for the new worker.');
      return;
    }
    const cleanEmail = newWorkerEmail.trim().toLowerCase();
    let assignedId = '';
    
    if (newWorkerRole === 'Admin') {
      assignedId = '#1945';
    } else {
      const existingWorker = registeredWorkers.find((w) => w.email.toLowerCase() === cleanEmail);
      if (existingWorker && existingWorker.id) {
        assignedId = existingWorker.id;
      } else {
        assignedId = generateEmployeeID(registeredWorkers);
      }
    }

    const newWorker: RegisteredWorker = {
      id: assignedId,
      fullName: newWorkerName.toUpperCase(),
      email: cleanEmail,
      role: newWorkerRole,
      phone: newWorkerPhone.trim() || '+971 50 000 0000',
      location: 'Al Bateen Hub',
      coordinates: '24.456338, 54.354812',
      status: 'Active',
    };

    const existingIndex = registeredWorkers.findIndex((w) => w.email.toLowerCase() === cleanEmail);
    let updatedList = [...registeredWorkers];
    if (existingIndex >= 0) {
      updatedList[existingIndex] = { ...updatedList[existingIndex], ...newWorker };
    } else {
      updatedList.push(newWorker);
    }

    setRegisteredWorkers(updatedList);
    setRegisteredWorkersCount(updatedList.length);
    setTotalActiveRoster(updatedList.filter((w) => !w.status || w.status === 'Active').length);

    try {
      await supabase.from('workers').upsert([
        {
          id: assignedId,
          full_name: newWorkerName.toUpperCase(),
          email: cleanEmail,
          role: newWorkerRole,
          status: 'Active',
          department: 'Restaurant Operations',
          phone: newWorkerPhone.trim() || '+971 50 000 0000',
        },
      ]);

      await AsyncStorage.setItem('@registered_workers_list', JSON.stringify(updatedList));
      await AsyncStorage.setItem(`@user_unique_id_${cleanEmail}`, assignedId);
      await AsyncStorage.setItem(`@full_name_${cleanEmail}`, newWorkerName.toUpperCase());
      await AsyncStorage.setItem(`@role_${cleanEmail}`, newWorkerRole);
    } catch (error) {
      // Local storage backup
    }

    setNewWorkerName('');
    setNewWorkerEmail('');
    setNewWorkerPhone('');
    setNewWorkerRole('Employee');
    setRegisterModalVisible(false);
    Alert.alert('Success', `Worker ${newWorker.fullName} registered successfully! ID: ${newWorker.id}`);
  };

  const pickMediaForAnnouncement = async () => {
    try {
      const remainingSlots = 3 - selectedMedia.length;
      if (remainingSlots <= 0) {
        Alert.alert('Limit Reached', 'You can attach a maximum of 3 files per announcement.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets) {
        const newAssets = result.assets.slice(0, remainingSlots).map((asset) => ({
          uri: asset.uri,
          type: asset.type === 'video' ? ('video' as const) : ('image' as const),
        }));
        setSelectedMedia((prev) => [...prev, ...newAssets]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pick media files.');
    }
  };

  const handleRemoveMedia = (index: number) => {
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePostGlobalAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      Alert.alert('Validation Error', 'Please provide both a title and message for the announcement.');
      return;
    }

    setPostingAnnouncement(true);
    try {
      const uploadedUrls: string[] = [];
      let generalMediaType = 'none';

      for (const media of selectedMedia) {
        generalMediaType = media.type;
        const response = await fetch(media.uri);
        const blob = await response.blob();
        const fileExt = media.type === 'video' ? 'mp4' : 'jpg';
        const fileName = `announcement_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data, error: uploadError } = await supabase.storage
          .from('announcements_media')
          .upload(fileName, blob);

        if (uploadError) throw uploadError;

        const { data: publicURLData } = supabase.storage
          .from('announcements_media')
          .getPublicUrl(data.path);

        uploadedUrls.push(publicURLData.publicUrl);
      }

      const { error } = await supabase.from('announcements').insert([
        {
          title: announcementTitle.trim(),
          message: announcementMessage.trim(),
          sender: userName || 'Admin',
          media_urls: uploadedUrls,
          media_url: uploadedUrls,
          media_type: generalMediaType,
          timestamp: new Date().toISOString(),
        },
      ]);

      if (error) {
        throw error;
      }

      setAnnouncementTitle('');
      setAnnouncementMessage('');
      setSelectedMedia([]);
      setAnnouncementModalVisible(false);
      Alert.alert('Success', 'Global announcement broadcasted successfully with selected media!');
    } catch (err: any) {
      Alert.alert('Broadcast Error', err.message || 'Failed to post announcement to Supabase.');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleDeleteRegisteredWorker = async (employeeId: string, employeeEmail?: string) => {
    try {
      const updatedWorkers = registeredWorkers.filter(
        (w) => w.id !== employeeId && (!employeeEmail || w.email.toLowerCase() !== employeeEmail.toLowerCase())
      );
      setRegisteredWorkers(updatedWorkers);
      setRegisteredWorkersCount(updatedWorkers.length);
      setTotalActiveRoster(updatedWorkers.filter((w) => !w.status || w.status === 'Active').length);

      await AsyncStorage.setItem('@registered_workers_list', JSON.stringify(updatedWorkers));

      if (employeeEmail) {
        try {
          await supabase.from('workers').delete().eq('email', employeeEmail.trim().toLowerCase());
        } catch (e) {
          // Handled gracefully
        }
        const cleanEmail = employeeEmail.trim().toLowerCase();
        const cleanId = employeeId.replace('#', '');
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
    } catch (error) {
      console.log('Failed to delete employee item:', error);
    }
  };

  const isDesktop = windowWidth > 900;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isLight ? '#f1f5f9' : '#2b5267', direction: isRTL ? 'rtl' : 'ltr' } as any]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Top Header Banner */}
        <View style={[styles.topBanner, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={[styles.bannerLeftBlock, isRTL && { flexDirection: 'row-reverse' }]}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.headerAvatarImage} />
            ) : (
              <View style={[styles.headerAvatarCircle, { backgroundColor: isLight ? '#cbd5e1' : '#1e3a4c' }]}>
                <Text style={[styles.headerAvatarText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>
                  {userName ? userName.charAt(0).toUpperCase() : 'M'}
                </Text>
              </View>
            )}
            <View>
              <Text style={[styles.bannerTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{t.portalTitle || 'AE UAE Workforce Portal'}</Text>
              <Text style={[styles.bannerSubtitle, activeTextStyle, isRTL && { textAlign: 'right' }]}>{t.portalSubtitle || 'PROPAGANDA HRMS - ABU DHABI'} ({userRole || 'Admin'})</Text>
            </View>
          </View>
          <View style={[styles.bannerRightBlock, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.badgeTop, { backgroundColor: isLight ? '#ffffff' : '#1e3a4c', borderColor: isLight ? '#cbd5e1' : '#334155' }]}>
              <Text style={[styles.badgeTopText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }]}>{portalLang === 'ar' ? 'نظام الحماية الآمن' : 'Enterprise Secure Matrix'}</Text>
            </View>
            <TouchableOpacity style={[styles.hamburgerCircleButton, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={() => setMenuVisible(true)}>
              <Text style={[styles.hamburgerText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content Grid */}
        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.cardDesktop]}>
          <View style={[styles.headerInfoBlock, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }]}>
            <Text style={[styles.cardMainTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{t.portalTitle || 'Propaganda Restaurant Abu Dhabi'}</Text>
            <Text style={[styles.cardSubTitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{t.portalSubtitle || 'Al Bateen Park Plaza Admin Matrix & Compliance Portal (Cloud Synced)'}</Text>
          </View>

          {/* Admin Session Status Card */}
          <View style={[styles.subCardRow, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.subCardLeft, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={styles.checkIconBox}><Text style={[styles.whiteCheck, activeTextStyle]}>✓</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.subCardTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'جلسة المشرف نشطة (السحابية)' : 'Admin Matrix Session Active (Cloud Synced)'}</Text>
                <Text style={[styles.subCardDesc, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'تم المصادقة مع مستوى صلاحية مالك/مشرف' : `Authenticated via JWT Token with Owner/${userRole || 'Admin'} Privilege Level (Real-time Cloud Worker Sync Enabled)`}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.adminLogoutBtn} onPress={onLogout}>
              <Text style={[styles.adminLogoutText, activeTextStyle]}>{t.logout || 'Admin Logout'}</Text>
            </TouchableOpacity>
          </View>

          {/* Metrics Row */}
          <View style={[styles.metricsGrid, isDesktop && styles.metricsGridDesktop, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={[styles.metricCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isDesktop && styles.metricCardFlex, isRTL && { flexDirection: 'row-reverse' }]}>
              <View>
                <Text style={[styles.metricLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'إجمالي القائمة النشطة' : 'TOTAL ACTIVE ROSTER'}</Text>
                <Text style={[styles.metricValue, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{totalActiveRoster}</Text>
              </View>
              <View style={styles.metricIconBox}><Text style={[styles.iconEmoji, activeTextStyle]}>👥</Text></View>
            </View>
            <View style={[styles.metricCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isDesktop && styles.metricCardFlex, isRTL && { flexDirection: 'row-reverse' }]}>
              <View>
                <Text style={[styles.metricLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'حالة نظام حماية الرواتب' : 'MOHRE WPS SIF STATUS'}</Text>
                <Text style={[styles.metricValueGreen, activeTextStyle, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'مكتمل بالكامل' : wpsStatus}</Text>
              </View>
              <View style={styles.greenIconBox}><Text style={[styles.whiteCheck, activeTextStyle]}>✓</Text></View>
            </View>
            <View style={[styles.metricCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isDesktop && styles.metricCardFlex, isRTL && { flexDirection: 'row-reverse' }]}>
              <View>
                <Text style={[styles.metricLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'موقع نظام تحديد الموقع (البطين)' : 'AL BATEEN HUB GPS'}</Text>
                <Text style={[styles.metricValueBlue, activeTextStyle, isRTL && { textAlign: 'right' }]}>24.4563382, 54.354812</Text>
              </View>
              <View style={styles.blueIconBox}><Text style={[styles.iconEmoji, activeTextStyle]}>📍</Text></View>
            </View>
            <View style={[styles.metricCard, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isDesktop && styles.metricCardFlex, isRTL && { flexDirection: 'row-reverse' }]}>
              <View>
                <Text style={[styles.metricLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'العاملون المسجلون' : 'REGISTERED WORKERS'}</Text>
                <Text style={[styles.metricValueYellow, activeTextStyle, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? `${registeredWorkersCount} نشط` : `${registeredWorkersCount} Active`}</Text>
              </View>
              <View style={styles.yellowIconBox}><Text style={[styles.iconEmoji, activeTextStyle]}>⭐</Text></View>
            </View>
          </View>
        </View>

        {/* Corporate Personnel Registry & Location Management Section */}
        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.cardDesktop]}>
          <View style={[styles.registryHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.cardMainTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'سجل موظفي الشركة وتتبع المواقع' : 'Corporate Personnel Registry & Location Tracking'}</Text>
            <TouchableOpacity style={styles.registerWorkerBtn} onPress={() => setRegisterModalVisible(true)}>
              <Text style={[styles.registerWorkerBtnText, activeTextStyle]}>{portalLang === 'ar' ? '+ تسجيل عامل جديد' : '+ Register New Worker'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.overviewSubHeader, activeTextStyle, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'الموظفون المسجلون - نظرة عامة في الوقت الفعلي' : 'Registered Employees — Real‑Time Overview'}</Text>
          <View style={styles.registryContainer}>
            <EmployeeOverviewScreen
              onBack={() => {
                if (onOpenEmployeeOverview) {
                  onOpenEmployeeOverview();
                }
              }}
              onViewProfile={(id, email) => {
                const formattedId = id.startsWith('#') ? id : `#${id}`;
                setSelectedProfileId(formattedId);
                setSelectedProfileEmail(email || null);
                setProfileModalVisible(true);
                if (onViewProfile) {
                  onViewProfile(formattedId, email);
                }
              }}
              onDeleteEmployee={(id, email) => handleDeleteRegisteredWorker(id, email)}
              onOpenAttendanceLogs={onOpenAttendanceLogs}
              onOpenLeaveManagement={onOpenLeaveManagement}
              onOpenPayslipManagement={onOpenPayslipManagement}
            />
          </View>
        </View>

        {/* Compliance Attendance Audit Stream */}
        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.cardDesktop]}>
          <View style={[styles.auditHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardMainTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'سجل تدقيق الحضور والمتابعة (متزامن في الوقت الفعلي)' : 'Compliance Attendance Audit Stream (Real-Time Synced)'}</Text>
            </View>
            <View style={[styles.auditHeaderRight, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.logCountBadge, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38' }]}>
                <Text style={[styles.logCountText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }]}>{portalLang === 'ar' ? `السجلات: ${logs.length > 0 ? logs.length : 4} إجمالي` : `Logs: ${logs.length > 0 ? logs.length : 4} Total`}</Text>
              </View>
              {onOpenAttendanceLogs && (
                <TouchableOpacity style={styles.recordNewListBtn} onPress={onOpenAttendanceLogs}>
                  <Text style={[styles.recordNewListText, activeTextStyle]}>{portalLang === 'ar' ? '📊 عرض كل السجلات' : '📊 View All Logs'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={[styles.tableHeaderRow, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]}>
            <Text style={[styles.tableHeadText, activeTextStyle, { flex: 1.2, color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'الموظف' : 'EMPLOYEE'}</Text>
            <Text style={[styles.tableHeadText, activeTextStyle, { flex: 1, color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'نوع الإجراء' : 'ACTION TYPE'}</Text>
            <Text style={[styles.tableHeadText, activeTextStyle, { flex: 1.2, color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'التاريخ / الوقت' : 'TIMESTAMP / DATE'}</Text>
            <Text style={[styles.tableHeadText, activeTextStyle, { flex: 1.3, color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'إحداثيات نظام تحديد الموقع' : 'GPS COORDINATES'}</Text>
            <Text style={[styles.tableHeadText, activeTextStyle, { flex: 1.2, color: isLight ? '#475569' : '#94a3b8', textAlign: isRTL ? 'left' : 'right' }]}>{portalLang === 'ar' ? 'حالة النطاق الجغرافي' : 'GEOFENCE STATUS'}</Text>
          </View>

          {logs.slice(0, 3).map((log, index) => (
            <View key={index} style={[styles.tableRow, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.tableCellMain, activeTextStyle, { flex: 1.2, color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>
                {log.employeeName || userName || 'FAHAD MUKASA'} ({log.employeeId || '#1945'})
              </Text>
              <Text style={[styles.tableCellSub, activeTextStyle, { flex: 1, color: isLight ? '#475569' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                {log.checkOut ? (portalLang === 'ar' ? 'تسجيل انصراف' : 'Check Out') : (portalLang === 'ar' ? 'تسجيل حضور' : 'Check In')}
              </Text>
              <Text style={[styles.tableCellSub, activeTextStyle, { flex: 1.2, color: isLight ? '#475569' : '#cbd5e1' }, isRTL && { textAlign: 'right' }]}>
                {log.date || (portalLang === 'ar' ? 'اليوم' : 'Today')}
              </Text>
              <Text style={[styles.tableCellGPS, activeTextStyle, { flex: 1.3 }, isRTL && { textAlign: 'right' }]}>
                {log.gpsLocation ? log.gpsLocation.split('(')[1]?.replace(')', '') || '24.456338, 54.354812' : '24.456338, 54.354812'}
              </Text>
              <View style={[styles.geofencePill, { flex: 1.2 }]}>
                <Text style={[styles.geofencePillText, activeTextStyle]}>{portalLang === 'ar' ? 'تم التحقق (مركز البطين)' : 'Verified (Al Bateen Hub)'}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Geofence Configuration Rules */}
        <View style={[styles.card, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isDesktop && styles.cardDesktop]}>
          <Text style={[styles.cardMainTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'قواعد إعدادات النطاق الجغرافي' : 'Geofence Configuration Rules'}</Text>
          <Text style={[styles.configLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'مركز المكتب الرئيسي (البطين)' : 'Center Office Hub (Al Bateen)'}</Text>
          <View style={[styles.configInputBox, { backgroundColor: isLight ? '#f8fafc' : '#0f172a', borderColor: isLight ? '#cbd5e1' : '#334155' }]}>
            <Text style={[styles.configInputText, activeTextStyle, isRTL && { textAlign: 'right' }]}>Lat: 24.4563382 Lng: 54.354812</Text>
          </View>
          <Text style={[styles.configLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'حد نصف قطر النطاق الجغرافي المسموح به (بالمتر)' : 'Allowed Geofence Radius Threshold (Meters)'}</Text>
          <TextInput
            style={[styles.configEditableInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#0f172a', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#334155' }, isRTL && { textAlign: 'right' }]}
            value={geofenceRadius}
            onChangeText={setGeofenceRadius}
            keyboardType="numeric"
          />
        </View>
      </ScrollView>

      {/* Admin Employee Profile View Modal */}
      <Modal animationType="slide" transparent={false} visible={profileModalVisible} onRequestClose={() => setProfileModalVisible(false)}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: isLight ? '#f1f5f9' : '#2b5267', direction: isRTL ? 'rtl' : 'ltr' } as any]}>
          <ProfileScreen
            onBack={() => setProfileModalVisible(false)}
            onProfileUpdated={() => loadManagementData()}
            currentLang={portalLang}
            employeeId={selectedProfileId}
            employeeEmail={selectedProfileEmail}
          />
        </SafeAreaView>
      </Modal>

      {/* Register New Worker Modal */}
      <Modal animationType="slide" transparent={true} visible={registerModalVisible} onRequestClose={() => setRegisterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'تسجيل عامل جديد' : 'Register New Worker'}</Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setRegisterModalVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.menuScroll}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'الاسم الكامل' : 'Full Name'}</Text>
                <TextInput
                  style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                  placeholder={portalLang === 'ar' ? 'مثال: أحمد محمد' : 'e.g. John Doe'}
                  placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
                  value={newWorkerName}
                  onChangeText={setNewWorkerName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}</Text>
                <TextInput
                  style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                  placeholder="e.g. john@propaganda.ae"
                  placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={newWorkerEmail}
                  onChangeText={setNewWorkerEmail}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</Text>
                <TextInput
                  style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                  placeholder="e.g. +971 50 123 4567"
                  placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
                  keyboardType="phone-pad"
                  value={newWorkerPhone}
                  onChangeText={setNewWorkerPhone}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'الدور المخصص' : 'Assigned Role'}</Text>
                <View style={[styles.pillRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  {['Employee', 'Supervisor', 'Manager', 'Admin'].map((roleItem) => (
                    <TouchableOpacity
                      key={roleItem}
                      style={[
                        styles.pill,
                        { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', borderColor: isLight ? '#cbd5e1' : '#2b5267' },
                        newWorkerRole === roleItem && styles.pillActive,
                      ]}
                      onPress={() => setNewWorkerRole(roleItem)}
                    >
                      <Text style={[styles.pillText, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, newWorkerRole === roleItem && styles.pillTextActive]}>{roleItem}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.submitWorkerBtn} onPress={handleSaveNewWorker}>
              <Text style={[styles.submitWorkerBtnText, activeTextStyle]}>{portalLang === 'ar' ? 'حفظ وتسجيل العامل' : 'Save & Register Worker'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Broadcast Global Announcement Modal with Multiple Media & Deletion Support */}
      <Modal animationType="slide" transparent={true} visible={announcementModalVisible} onRequestClose={() => setAnnouncementModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'إذاعة إعلان عام' : 'Broadcast Global Announcement'}</Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setAnnouncementModalVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.menuScroll}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'عنوان الإعلان' : 'Announcement Title'}</Text>
                <TextInput
                  style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267' }, isRTL && { textAlign: 'right' }]}
                  placeholder={portalLang === 'ar' ? 'مثال: تحديث صيانة النظام' : 'e.g. System Maintenance Update'}
                  placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
                  value={announcementTitle}
                  onChangeText={setAnnouncementTitle}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'نص الرسالة' : 'Message Body'}</Text>
                <TextInput
                  style={[styles.textInput, activeTextStyle, { backgroundColor: isLight ? '#f8fafc' : '#1a2c38', color: isLight ? '#0f172a' : '#ffffff', borderColor: isLight ? '#cbd5e1' : '#2b5267', height: 100, textAlignVertical: 'top' }, isRTL && { textAlign: 'right' }]}
                  placeholder={portalLang === 'ar' ? 'اكتب تفاصيل الإعلان هنا...' : 'Write your announcement details here...'}
                  placeholderTextColor={isLight ? '#94a3b8' : '#64748b'}
                  multiline
                  value={announcementMessage}
                  onChangeText={setAnnouncementMessage}
                />
              </View>

              {/* Media Attachments Section with Limit Indicator and Deletion */}
              <View style={styles.inputGroup}>
                <View style={[styles.mediaLabelRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={[styles.inputLabel, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8', marginBottom: 0 }, isRTL && { textAlign: 'right' }]}>
                    {portalLang === 'ar' ? 'المرفقات (صور أو فيديوهات)' : 'Attach Media (Images / Videos)'}
                  </Text>
                  <Text style={[styles.limitIndicatorText, activeTextStyle]}>
                    ({selectedMedia.length}/3 {portalLang === 'ar' ? 'ملفات' : 'files'})
                  </Text>
                </View>

                {selectedMedia.length < 3 && (
                  <TouchableOpacity style={styles.mediaPickerButton} onPress={pickMediaForAnnouncement}>
                    <Text style={[styles.mediaPickerButtonText, activeTextStyle]}>
                      {portalLang === 'ar' ? '📁 اختيار صور أو فيديوهات (حتى 3)' : '📁 Choose Images / Videos (Up to 3)'}
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedMedia.length > 0 && (
                  <View style={styles.previewContainer}>
                    {selectedMedia.map((media, idx) => (
                      <View key={idx} style={styles.previewWrapper}>
                        <Image source={{ uri: media.uri }} style={styles.previewThumbnail} />
                        <Text style={styles.previewTypeTag}>{media.type.toUpperCase()}</Text>
                        <TouchableOpacity style={styles.removeMediaBtn} onPress={() => handleRemoveMedia(idx)}>
                          <Text style={styles.removeMediaBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.submitWorkerBtn} onPress={handlePostGlobalAnnouncement} disabled={postingAnnouncement}>
              {postingAnnouncement ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={[styles.submitWorkerBtnText, activeTextStyle]}>
                  {portalLang === 'ar' ? 'نشر الإعلان مع المرفقات المتبقية' : 'Post Announcement with Media'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Comprehensive Management Menu Modal */}
      <Modal animationType="slide" transparent={true} visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: isLight ? '#ffffff' : '#12202a', borderColor: isLight ? '#e2e8f0' : '#1e3a4c' }, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? '#e2e8f0' : '#1e3a4c' }, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={[styles.modalTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{t.employeeMenu || 'Management Menu'}</Text>
              <TouchableOpacity style={[styles.closeIconBtn, { backgroundColor: isLight ? '#e2e8f0' : '#1e3a4c' }]} onPress={() => setMenuVisible(false)}>
                <Text style={[styles.closeIconText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.menuScroll}>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); setAnnouncementModalVisible(true); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>📢</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'نشر إعلان عام' : 'Global Announcements'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'إذاعة إعلانات وتحديثات مع وسائط لجميع العاملين' : 'Broadcast system-wide updates & media to all employees'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenAnnouncementsManagement) onOpenAnnouncementsManagement(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>📋</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'إدارة الإعلانات المرسلة' : 'Manage Announcements History'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'عرض السجلات وإدارة الإعلانات السابقة' : 'Review past broadcasts and logs'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenEmployeeOverview) onOpenEmployeeOverview(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>👥</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'نظرة عامة على الموظفين' : 'Employee Overview'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'عرض الموظفين المسجلين والحالة والإجراءات السريعة' : 'View registered employees, status, and quick actions'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenAttendanceLogs) onOpenAttendanceLogs(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>📊</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{t.attendance || 'Attendance & GPS Logs'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{t.attendanceSub || 'Review live attendance records, hours, and filters'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenShiftManagement) onOpenShiftManagement(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>⏰</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'إدارة المناوبات' : 'Shift Management'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'تعيين وتعديل وتبديل المناوبات وعرض الجداول' : 'Assign, edit, swap shifts & view rosters'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenLeaveManagement) onOpenLeaveManagement(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>🌴</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{t.leave || 'Leave Requests'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{t.leaveSub || 'Approve/reject leave, check balances & history'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenPayslipManagement) onOpenPayslipManagement(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>💰</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'مراجعة قسائم الرواتب' : 'Payslip Review'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'التحقق من سجلات الرواتب وتنزيلها وإرسالها' : 'Verify salary records, download & send payslips'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenExpenseClaims) onOpenExpenseClaims(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>🧾</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'مطالبات النفقات' : 'Expense Claims Management'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'مراجعة واعتماد أو رفض نفقات الموظفين' : 'Review, approve or reject employee expense claims'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenReportsAnalytics) onOpenReportsAnalytics(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>📈</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'التقارير والتحليلات' : 'Reports & Analytics'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{portalLang === 'ar' ? 'ملخصات الحضور والرواتب وتصدير التدقيق' : 'Summaries for attendance, payroll & audit exports'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { borderBottomColor: isLight ? '#f1f5f9' : '#1a2c38' }, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setMenuVisible(false); if (onOpenSettings) onOpenSettings(); }}>
                <Text style={[styles.menuIcon, activeTextStyle, isRTL ? { marginLeft: 16, marginRight: 0 } : { marginRight: 16 }]}>⚙️</Text>
                <View style={[styles.menuTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                  <Text style={[styles.menuItemTitle, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }, isRTL && { textAlign: 'right' }]}>{t.settings || 'Settings'}</Text>
                  <Text style={[styles.menuItemSubtitle, activeTextStyle, { color: isLight ? '#475569' : '#94a3b8' }, isRTL && { textAlign: 'right' }]}>{t.settingsSub || 'Manage system preferences, notifications & language'}</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={[styles.closeMenuButton, { backgroundColor: isLight ? '#cbd5e1' : '#2b5267' }]} onPress={() => setMenuVisible(false)}>
              <Text style={[styles.closeMenuButtonText, activeTextStyle, { color: isLight ? '#0f172a' : '#ffffff' }]}>{t.closeMenu || 'Close Menu'}</Text>
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
  topBanner: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4, flexWrap: 'wrap', gap: 12 },
  bannerLeftBlock: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerAvatarCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#f59e0b' },
  headerAvatarText: { fontWeight: 'bold' },
  headerAvatarImage: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#f59e0b' },
  bannerTitle: { fontWeight: 'bold' },
  bannerSubtitle: { fontWeight: 'bold', color: '#f59e0b', marginTop: 2, letterSpacing: 0.5 },
  bannerRightBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeTop: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  badgeTopText: { fontWeight: 'bold' },
  hamburgerCircleButton: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  hamburgerText: { fontWeight: 'bold' },
  card: { width: '100%', borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, borderWidth: 1 },
  cardDesktop: { padding: 32 },
  headerInfoBlock: { marginBottom: 16, borderBottomWidth: 1, paddingBottom: 12 },
  cardMainTitle: { fontWeight: 'bold' },
  cardSubTitle: { marginTop: 3 },
  subCardRow: { borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderWidth: 1, flexWrap: 'wrap', gap: 12 },
  subCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12, minWidth: 280 },
  checkIconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  whiteCheck: { color: '#ffffff', fontWeight: 'bold' },
  subCardTitle: { fontWeight: 'bold' },
  subCardDesc: { marginTop: 2 },
  adminLogoutBtn: { backgroundColor: '#991b1b', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  adminLogoutText: { color: '#ffffff', fontWeight: 'bold' },
  metricsGrid: { width: '100%', gap: 12, marginBottom: 12 },
  metricsGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  metricCard: { borderRadius: 16, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1 },
  metricCardFlex: { flex: 1, minWidth: 220 },
  metricLabel: { fontWeight: 'bold', letterSpacing: 0.5 },
  metricValue: { fontWeight: 'bold', marginTop: 4 },
  metricValueGreen: { fontWeight: 'bold', color: '#34d399', marginTop: 4 },
  metricValueBlue: { fontWeight: 'bold', color: '#38bdf8', marginTop: 4 },
  metricValueYellow: { fontWeight: 'bold', color: '#fbbf24', marginTop: 4 },
  metricIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center' },
  greenIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#065f46', justifyContent: 'center', alignItems: 'center' },
  blueIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1e40af', justifyContent: 'center', alignItems: 'center' },
  yellowIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#78350f', justifyContent: 'center', alignItems: 'center' },
  iconEmoji: {},
  registryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  registerWorkerBtn: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  registerWorkerBtnText: { color: '#ffffff', fontWeight: 'bold' },
  overviewSubHeader: { fontWeight: 'bold', color: '#38bdf8', marginBottom: 12, marginTop: 4 },
  registryContainer: { width: '100%' },
  auditHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 },
  auditHeaderRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  logCountBadge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  logCountText: { fontWeight: 'bold' },
  recordNewListBtn: { backgroundColor: '#065f46', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  recordNewListText: { color: '#ffffff', fontWeight: 'bold' },
  tableHeaderRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, marginBottom: 8 },
  tableHeadText: { fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, alignItems: 'center', marginBottom: 8, borderWidth: 1 },
  tableCellMain: { fontWeight: 'bold' },
  tableCellSub: {},
  tableCellGPS: { color: '#38bdf8' },
  geofencePill: { backgroundColor: '#065f46', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center' },
  geofencePillText: { color: '#34d399', fontWeight: 'bold' },
  configLabel: { fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
  configInputBox: { borderRadius: 10, padding: 12, borderWidth: 1 },
  configInputText: { color: '#38bdf8', fontWeight: '600' },
  configEditableInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 520, maxHeight: '85%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, paddingBottom: 16, marginBottom: 12 },
  modalTitle: { fontWeight: 'bold' },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  closeIconText: { fontWeight: 'bold' },
  menuScroll: { marginVertical: 4, maxHeight: 420 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  menuIcon: { marginRight: 16 },
  menuTextContainer: { flex: 1 },
  menuItemTitle: { fontWeight: 'bold' },
  menuItemSubtitle: { marginTop: 2 },
  closeMenuButton: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  closeMenuButtonText: { fontWeight: 'bold', letterSpacing: 0.5 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontWeight: 'bold', marginBottom: 8 },
  textInput: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1 },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontWeight: '500' },
  pillTextActive: { color: '#ffffff', fontWeight: 'bold' },
  submitWorkerBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitWorkerBtnText: { color: '#ffffff', fontWeight: 'bold' },
  mediaLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  limitIndicatorText: { fontSize: 12, color: '#38bdf8', fontWeight: 'bold' },
  mediaPickerButton: { backgroundColor: '#1e3a4c', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  mediaPickerButtonText: { color: '#ffffff', fontWeight: 'bold' },
  previewContainer: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  previewWrapper: { width: 84, height: 84, borderRadius: 8, overflow: 'hidden', backgroundColor: '#334155', position: 'relative', borderWidth: 1, borderColor: '#475569' },
  previewThumbnail: { width: '100%', height: '100%' },
  previewTypeTag: { position: 'absolute', bottom: 2, left: 2, backgroundColor: 'rgba(0,0,0,0.75)', color: '#ffffff', fontSize: 8, paddingHorizontal: 4, borderRadius: 3, fontWeight: 'bold' },
  removeMediaBtn: { position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#dc2626', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ffffff' },
  removeMediaBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
});