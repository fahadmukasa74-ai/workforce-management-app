import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Image,
  Modal,
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

interface AttendanceLog {
  id?: string;
  checkIn: number;
  checkOut: number | null;
  hoursWorked: number;
  earnings: number;
  status: 'Present' | 'Late' | 'Absent' | 'On Leave' | 'Overtime';
}

interface EmployeeHomeScreenProps {
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenPayslips: () => void;
  onOpenLeave: () => void;
  onOpenShifts: () => void;
  onOpenAttendance: () => void;
  onOpenMessages?: () => void;
  onOpenExpenseClaims?: () => void;
  onOpenAnnouncements?: () => void;
  userName: string;
  profileImage: string | null;
  currentLang: 'en' | 'ar';
  employeeId?: string;
  userEmail?: string;
}

export default function EmployeeHomeScreen({
  onLogout,
  onOpenSettings,
  onOpenProfile,
  onOpenPayslips,
  onOpenLeave,
  onOpenShifts,
  onOpenAttendance,
  onOpenMessages,
  onOpenExpenseClaims,
  onOpenAnnouncements,
  userName,
  profileImage,
  currentLang,
  employeeId,
  userEmail,
}: EmployeeHomeScreenProps) {
  const [useLiveGps, setUseLiveGps] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [resolvedProfileImage, setResolvedProfileImage] = useState<string | null>(profileImage);
  const [userUniqueId, setUserUniqueId] = useState('#1945');
  const [activeCheckin, setActiveCheckin] = useState<number | null>(null);
  const [activeOvertime, setActiveOvertime] = useState<number | null>(null);
  
  // Separate unread counts for announcements and messages
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const HOURLY_RATE = 29;
  const t: any = translationsMap[currentLang];

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    setCurrentDate(new Date().toLocaleDateString(currentLang === 'ar' ? 'ar-AE' : 'en-US', options));
    loadActiveStatus();
    checkUnreadAlerts();

    // Real-time listener for announcements and messages
    const channel = supabase
      .channel('public-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        () => {
          checkUnreadAlerts();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          checkUnreadAlerts();
        }
      )
      .subscribe();

    const interval = setInterval(checkUnreadAlerts, 4000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [currentLang, employeeId, profileImage, userEmail]);

  const checkUnreadAlerts = async () => {
    try {
      const activeEmail = userEmail || (await AsyncStorage.getItem('@active_session_email')) || '';
      const cleanEmail = activeEmail.trim().toLowerCase();
      const savedId = await AsyncStorage.getItem(`@user_unique_id_${cleanEmail}`);
      const cleanId = (savedId || employeeId || '#1945').replace('#', '');

      if (!cleanEmail) return;

      let annCount = 0;
      let msgCount = 0;

      // Check unread announcements from Supabase
      const lastReadAnnouncementTime = (await AsyncStorage.getItem(`@last_read_announcement_${cleanEmail}`)) || '0';
      try {
        const { count: announcementsCount, error } = await supabase
          .from('announcements')
          .select('*', { count: 'exact', head: true })
          .gt('timestamp', new Date(Number(lastReadAnnouncementTime)).toISOString());

        if (!error && announcementsCount !== null) {
          annCount = announcementsCount;
        }
      } catch (err) {
        // Fallback if offline
      }

      // Check direct messages / notifications
      const msgKey = `@employee_message_${cleanEmail}_${cleanId}`;
      const savedMsgs = await AsyncStorage.getItem(msgKey);
      if (savedMsgs) {
        const parsed = JSON.parse(savedMsgs);
        msgCount += parsed.filter((m: any) => m.status === 'Unread').length;
      }

      const globalJson = await AsyncStorage.getItem('@all_corporate_messages');
      if (globalJson) {
        const globalList = JSON.parse(globalJson);
        const unreadGlobal = globalList.filter((m: any) => 
          (m.recipient?.trim().toLowerCase() === cleanEmail || m.recipientId?.replace('#', '') === cleanId) && 
          m.status === 'Unread'
        ).length;
        msgCount += unreadGlobal;
      }

      setAnnouncementUnreadCount(annCount);
      setMessageUnreadCount(msgCount);
      setUnreadCount(annCount + msgCount);
    } catch (error) {
      console.log('Failed to check unread alerts', error);
    }
  };

  const markAnnouncementsAsRead = async () => {
    try {
      const activeEmail = userEmail || (await AsyncStorage.getItem('@active_session_email')) || '';
      const cleanEmail = activeEmail.trim().toLowerCase();
      if (cleanEmail) {
        await AsyncStorage.setItem(`@last_read_announcement_${cleanEmail}`, String(Date.now()));
      }
      checkUnreadAlerts();
    } catch (e) {
      console.log('Failed to mark announcements as read', e);
    }
  };

  const loadActiveStatus = async () => {
    try {
      const activeEmail = userEmail || (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
      const cleanEmail = activeEmail.trim().toLowerCase();

      const savedEmailSpecificId = await AsyncStorage.getItem(`@user_unique_id_${cleanEmail}`);
      const resolvedId = savedEmailSpecificId || employeeId || (cleanEmail === 'fahadmukasa74@gmail.com' ? '#1945' : '#5984');

      setUserUniqueId(resolvedId.startsWith('#') ? resolvedId : `#${resolvedId}`);

      const cleanId = resolvedId.replace('#', '');
      const savedCheckIn = await AsyncStorage.getItem(`@active_check_in_${cleanEmail}`);
      const savedOvertime = await AsyncStorage.getItem(`@active_overtime_${cleanEmail}`);

      if (savedCheckIn) setActiveCheckin(Number(savedCheckIn));
      if (savedOvertime) setActiveOvertime(Number(savedOvertime));

      const isAdminUser = cleanEmail === 'fahadmukasa74@gmail.com' || cleanId === '1945';
      if (isAdminUser) {
        const adminImg = await AsyncStorage.getItem('@profile_image_fahadmukasa74@gmail.com');
        setResolvedProfileImage(adminImg || profileImage);
      } else if (cleanEmail && cleanId) {
        const savedImage = await AsyncStorage.getItem(`@profile_image_${cleanEmail}_${cleanId}`);
        setResolvedProfileImage(savedImage && !savedImage.startsWith('blob:') ? savedImage : profileImage);
      } else {
        setResolvedProfileImage(profileImage);
      }
    } catch (error) {
      console.log('Failed to load active status', error);
    }
  };

  const updateGlobalLog = async (logItem: AttendanceLog) => {
    try {
      const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
      const cleanEmail = activeEmail.trim().toLowerCase();
      const name = (await AsyncStorage.getItem(`@full_name_${cleanEmail}`)) || userName || 'Employee';
      const role = cleanEmail === 'fahadmukasa74@gmail.com' ? 'Admin' : 'Employee';
      const cleanId = userUniqueId.replace('#', '');

      const formattedGlobalLog = {
        id: logItem.id || `log-${logItem.checkIn}`,
        employeeId: userUniqueId,
        email: cleanEmail,
        employeeName: name,
        role: role,
        department: 'General Staff',
        checkIn: new Date(logItem.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        checkOut: logItem.checkOut ? new Date(logItem.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active',
        totalHours: logItem.checkOut ? `${logItem.hoursWorked.toFixed(2)} hrs` : 'Ongoing',
        status: logItem.status,
        date: new Date(logItem.checkIn).toISOString().split('T')[0],
        earnings: logItem.earnings,
        gpsLocation: '24.456338, 54.354812',
      };

      const { error: cloudError } = await supabase.from('attendance_logs').upsert([
        {
          id: formattedGlobalLog.id,
          employee_id: userUniqueId,
          email: cleanEmail,
          employee_name: name,
          role: role,
          check_in: formattedGlobalLog.checkIn,
          check_out: formattedGlobalLog.checkOut,
          total_hours: formattedGlobalLog.totalHours,
          status: logItem.status,
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
      const existingIndex = globalList.findIndex((l: any) => l.id === formattedGlobalLog.id);

      if (existingIndex >= 0) {
        globalList[existingIndex] = formattedGlobalLog;
      } else {
        globalList = [formattedGlobalLog, ...globalList];
      }

      const trimmedGlobalList = globalList.slice(0, 15);
      await AsyncStorage.setItem('@global_attendance_logs', JSON.stringify(trimmedGlobalList));

      const payslipKey = `@payslip_${cleanEmail}_${cleanId}`;
      const userLogs = trimmedGlobalList.filter((l: any) => l.email?.trim().toLowerCase() === cleanEmail);
      await AsyncStorage.setItem(payslipKey, JSON.stringify(userLogs));
    } catch (e) {
      console.log('Failed to sync global log to cloud/storage', e);
    }
  };

  const handleHomeCheckIn = async () => {
    if (activeCheckin !== null) {
      Alert.alert('Notice', currentLang === 'ar' ? 'أنت مسجل حضور بالفعل!' : 'You are already checked in!');
      return;
    }
    const now = Date.now();
    setActiveCheckin(now);
    const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
    await AsyncStorage.setItem(`@active_check_in_${activeEmail.trim().toLowerCase()}`, String(now));

    const newLog: AttendanceLog = {
      id: `log-${now}`,
      checkIn: now,
      checkOut: null,
      hoursWorked: 0,
      earnings: 0,
      status: 'Present',
    };

    await updateGlobalLog(newLog);
    Alert.alert(
      currentLang === 'ar' ? 'تم تسجيل الحضور' : 'Check-In Successful',
      currentLang === 'ar' ? 'تم تسجيل الحضور وبدء المؤقت.' : 'Timestamp recorded & synced to cloud. Attendance timer started.'
    );
  };

  const handleHomeCheckout = async () => {
    if (activeCheckin === null) {
      Alert.alert('Notice', currentLang === 'ar' ? 'يجب تسجيل الحضور أولاً!' : 'You must check in first!');
      return;
    }
    const now = Date.now();
    const diffMs = now - activeCheckin;
    const hoursWorked = diffMs / (1000 * 60 * 60);
    const earnings = hoursWorked * HOURLY_RATE;
    const checkInDate = new Date(activeCheckin);
    const status = checkInDate.getHours() >= 9 ? 'Late' : 'Present';
    const logId = `log-${activeCheckin}`;

    const newLog: AttendanceLog = {
      id: logId,
      checkIn: activeCheckin,
      checkOut: now,
      hoursWorked: Number(hoursWorked.toFixed(4)),
      earnings: Number(earnings.toFixed(2)),
      status,
    };

    try {
      const activeEmail = (await AsyncStorage.getItem('@active_session_email')) || 'fahadmukasa74@gmail.com';
      const cleanEmail = activeEmail.trim().toLowerCase();
      const savedLogs = await AsyncStorage.getItem(`@attendance_logs_${cleanEmail}`);
      const existingLogs: AttendanceLog[] = savedLogs ? JSON.parse(savedLogs) : [];
      const updatedLogs = [newLog, ...existingLogs.filter(l => l.id !== logId)];

      setActiveCheckin(null);
      await AsyncStorage.removeItem(`@active_check_in_${cleanEmail}`);
      await AsyncStorage.setItem(`@attendance_logs_${cleanEmail}`, JSON.stringify(updatedLogs));
      await updateGlobalLog(newLog);

      Alert.alert(
        currentLang === 'ar' ? 'تسجيل الخروج' : 'Check-Out Successful',
        `Worked: ${hoursWorked.toFixed(2)} hrs\nEarned: ${earnings.toFixed(2)} AED\nSynced to Cloud & Payslips.`
      );
    } catch (error) {
      console.log('Failed to checkout', error);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction: currentLang === 'ar' ? 'rtl' : 'ltr' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{t.portalTitle}</Text>
          <Text style={styles.headerSubtitle}>{t.portalSubtitle}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <Text style={styles.dateText}>{currentDate}</Text>
            <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
              <Text style={styles.menuButtonText}>☰</Text>
              {unreadCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.avatarContainer}>
            {resolvedProfileImage ? (
              <Image source={{ uri: resolvedProfileImage }} style={styles.profileAvatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{userName ? userName.charAt(0).toUpperCase() : 'F'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.welcomeText}>
            {t.welcomeBack} {userName ? userName.toUpperCase() : 'FAHAD MUKASA'}
            {'\n'}
            <Text style={styles.idHighlightText}>ID: {userUniqueId}</Text>
          </Text>
        </View>

        <View style={styles.gpsCard}>
          <Text style={styles.gpsLabel}>{t.useGps}</Text>
          <Switch
            trackColor={{ false: '#cbd5e1', true: '#2b5267' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#cbd5e1"
            onValueChange={() => setUseLiveGps(!useLiveGps)}
            value={useLiveGps}
          />
        </View>

        <View style={styles.gridContainer}>
          <TouchableOpacity style={styles.gridItem} onPress={handleHomeCheckIn}>
            <View style={styles.iconBox}><Text style={styles.iconSymbol}>📥</Text></View>
            <Text style={styles.gridItemText}>{t.checkIn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gridItem} onPress={handleHomeCheckout}>
            <View style={styles.iconBox}><Text style={styles.iconSymbol}>📤</Text></View>
            <Text style={styles.gridItemText}>{t.checkOut}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gridItem} onPress={onOpenAttendance}>
            <View style={styles.iconBox}><Text style={styles.iconSymbol}>📋</Text></View>
            <Text style={styles.gridItemText}>{t.absensiLog}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gridItem} onPress={onOpenPayslips}>
            <View style={styles.iconBox}><Text style={styles.iconSymbol}>💰</Text></View>
            <Text style={styles.gridItemText}>{t.payslips}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gridItem} onPress={onOpenShifts}>
            <View style={styles.iconBox}><Text style={styles.iconSymbol}>📅</Text></View>
            <Text style={styles.gridItemText}>{t.shifts}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gridItem} onPress={() => setMenuVisible(true)}>
            <View style={styles.iconBox}><Text style={styles.iconSymbol}>⚙️</Text></View>
            <Text style={styles.gridItemText}>{t.more}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>{t.logout}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal animationType="slide" transparent={true} visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.employeeMenu}</Text>
              <TouchableOpacity style={styles.closeIconBtn} onPress={() => setMenuVisible(false)}>
                <Text style={styles.closeIconText}>X</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.menuScroll}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  markAnnouncementsAsRead();
                  if (onOpenAnnouncements) {
                    onOpenAnnouncements();
                  } else {
                    Alert.alert('Notice', 'Announcements screen handler not configured yet.');
                  }
                }}
              >
                <Text style={styles.menuIcon}>📢</Text>
                <View style={styles.menuTextContainer}>
                  <View style={styles.menuItemTitleRow}>
                    <Text style={styles.menuItemTitle}>
                      {currentLang === 'ar' ? 'الإعلانات والتهديف العام' : 'Announcements'}
                    </Text>
                    {announcementUnreadCount > 0 && (
                      <View style={styles.menuBadge}>
                        <Text style={styles.menuBadgeText}>{announcementUnreadCount} New</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.menuItemSubtitle}>
                    {currentLang === 'ar' ? 'عرض الإعلانات والتحديثات العامة' : 'View global announcements from admin'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  if (onOpenMessages) {
                    onOpenMessages();
                  }
                }}
              >
                <Text style={styles.menuIcon}>💬</Text>
                <View style={styles.menuTextContainer}>
                  <View style={styles.menuItemTitleRow}>
                    <Text style={styles.menuItemTitle}>
                      {currentLang === 'ar' ? 'الإشعارات والرسائل' : 'Messages / Notifications'}
                    </Text>
                    {messageUnreadCount > 0 && (
                      <View style={styles.menuBadge}>
                        <Text style={styles.menuBadgeText}>{messageUnreadCount} New</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.menuItemSubtitle}>
                    {currentLang === 'ar' ? 'عرض الرسائل الإدارية الواردة' : 'View Admin messages and alerts'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  if (onOpenExpenseClaims) {
                    onOpenExpenseClaims();
                  } else {
                    Alert.alert('Notice', 'Expense Claims screen handler not configured yet.');
                  }
                }}
              >
                <Text style={styles.menuIcon}>🧾</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>
                    {currentLang === 'ar' ? 'مطالبات النفقات' : 'Expense Claims'}
                  </Text>
                  <Text style={styles.menuItemSubtitle}>
                    {currentLang === 'ar' ? 'تقديم ومتابعة مطالبات النفقات' : 'Submit and track expense requests'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onOpenAttendance(); }}>
                <Text style={styles.menuIcon}>📋</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{t.attendance}</Text>
                  <Text style={styles.menuItemSubtitle}>{t.attendanceSub}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onOpenShifts(); }}>
                <Text style={styles.menuIcon}>📅</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{t.shifts}</Text>
                  <Text style={styles.menuItemSubtitle}>{t.shiftsSub}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onOpenLeave(); }}>
                <Text style={styles.menuIcon}>🏖️</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{t.leave}</Text>
                  <Text style={styles.menuItemSubtitle}>{t.leaveSub}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onOpenPayslips(); }}>
                <Text style={styles.menuIcon}>💰</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{t.payslips}</Text>
                  <Text style={styles.menuItemSubtitle}>{t.payslipsSub}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onOpenProfile(); }}>
                <Text style={styles.menuIcon}>👤</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{t.profile}</Text>
                  <Text style={styles.menuItemSubtitle}>{t.profileSub}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onOpenSettings(); }}>
                <Text style={styles.menuIcon}>⚙️</Text>
                <View style={styles.menuTextContainer}>
                  <Text style={styles.menuItemTitle}>{t.settings}</Text>
                  <Text style={styles.menuItemSubtitle}>{t.settingsSub}</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity style={styles.closeMenuButton} onPress={() => setMenuVisible(false)}>
              <Text style={styles.closeMenuButtonText}>{t.closeMenu}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2b5267' },
  container: { padding: 16, alignItems: 'center', paddingBottom: 40 },
  headerContainer: { width: '100%', maxWidth: 550, marginBottom: 20, paddingHorizontal: 4 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  headerSubtitle: { fontSize: 13, color: '#cbd5e1', marginTop: 2 },
  card: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 24, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  menuButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2b5267', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  menuButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  badgeContainer: { position: 'absolute', top: -4, right: -4, backgroundColor: '#dc2626', minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#ffffff', paddingHorizontal: 2 },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  avatarContainer: { alignItems: 'center', marginVertical: 12 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2b5267', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#ffffff' },
  profileAvatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: '#2b5267' },
  welcomeText: { fontSize: 15, fontWeight: 'bold', textAlign: 'center', color: '#0f172a', marginTop: 4, letterSpacing: 0.5 },
  idHighlightText: { color: '#2b5267', fontWeight: 'bold' },
  gpsCard: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  gpsLabel: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  gridContainer: { width: '100%', maxWidth: 550, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, marginBottom: 20 },
  gridItem: { width: '30%', minWidth: 105, flexGrow: 1, backgroundColor: '#f8fafc', borderRadius: 20, paddingVertical: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#2b5267', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  iconSymbol: { fontSize: 22 },
  gridItemText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  logoutButton: { width: '100%', maxWidth: 550, backgroundColor: '#dc2626', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  logoutButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: '#f8fafc', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 16, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  closeIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  closeIconText: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  menuScroll: { marginVertical: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuIcon: { fontSize: 24, marginRight: 16 },
  menuTextContainer: { flex: 1 },
  menuItemTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuItemTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  menuBadge: { backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  menuBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  menuItemSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  closeMenuButton: { backgroundColor: '#2b5267', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  closeMenuButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
});