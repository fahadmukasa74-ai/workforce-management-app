import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
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

interface ShiftsScreenProps {
  onBack: () => void;
  currentLang: 'en' | 'ar';
}

interface ShiftItem {
  id: string;
  date: string;
  time: string;
  location: string;
  status: 'Assigned' | 'Swap Requested' | 'Approved Swap';
}

export default function ShiftsScreen({ onBack, currentLang }: ShiftsScreenProps) {
  const [activeTab, setActiveTab] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
  const [swapReasons, setSwapReasons] = useState<{ [key: string]: string }>({});
  const [userUniqueId, setUserUniqueId] = useState('#1945');
  const [shifts, setShifts] = useState<ShiftItem[]>([]);

  const t = translationsMap[currentLang];

  useEffect(() => {
    loadShifts();
    const interval = setInterval(loadShifts, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadShifts = async () => {
    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const resolvedEmail = activeEmail ? activeEmail.trim().toLowerCase() : 'fahadmukasa74@gmail.com';

      // Read ID strictly from the required email key format
      const savedEmailSpecificId = await AsyncStorage.getItem(`@user_unique_id_${resolvedEmail}`);
      const savedGeneralId = await AsyncStorage.getItem('@user_unique_id');

      const resolvedId = savedEmailSpecificId || savedGeneralId || (resolvedEmail === 'fahadmukasa74@gmail.com' ? '#1945' : '#1945');

      setUserUniqueId(resolvedId.startsWith('#') ? resolvedId : `#${resolvedId}`);

      const cleanEmail = resolvedEmail;
      const cleanId = resolvedId.replace('#', '');

      // --- FETCH SHIFTS FROM SUPABASE CLOUD ---
      let cloudLoaded = false;
      const { data: cloudShifts, error: cloudError } = await supabase
        .from('shifts')
        .select('*');

      if (!cloudError && cloudShifts && cloudShifts.length > 0) {
        const filteredCloud = cloudShifts.filter((s: any) => {
          const empEmail = s.employee_email || s.employeeEmail || '';
          const empId = s.employee_id || s.employeeId || '';
          return (
            empEmail.trim().toLowerCase() === cleanEmail ||
            empId === resolvedId ||
            empId === cleanId
          );
        });

        if (filteredCloud.length > 0) {
          cloudLoaded = true;
          const mapped: ShiftItem[] = filteredCloud.map((s: any) => ({
            id: s.id,
            date: s.shift_date || s.shiftDate || '',
            time: `${s.start_time || s.startTime || ''} - ${s.end_time || s.endTime || ''}`,
            location: s.location || 'Propaganda Restaurant Al Bateen Park Plaza',
            status: (s.status === 'Swapped' || s.status === 'Swap Requested'
              ? 'Swap Requested'
              : s.status === 'Approved Swap'
              ? 'Approved Swap'
              : 'Assigned') as ShiftItem['status'],
          }));
          setShifts(mapped);
        }
      }

      if (!cloudLoaded) {
        const specificKey = `@shift_${cleanEmail}_${cleanId}`;
        const specificShiftData = await AsyncStorage.getItem(specificKey);
        const globalRosters = await AsyncStorage.getItem('@global_shift_rosters');

        if (specificShiftData) {
          setShifts(JSON.parse(specificShiftData));
        } else if (globalRosters && cleanEmail) {
          const parsedRosters = JSON.parse(globalRosters);
          const matchingUserShifts = parsedRosters.filter(
            (s: any) =>
              s.employeeEmail?.trim().toLowerCase() === cleanEmail ||
              s.employeeId === resolvedId
          );

          if (matchingUserShifts.length > 0) {
            const mapped: ShiftItem[] = matchingUserShifts.map((s: any) => ({
              id: s.id,
              date: s.shiftDate || '',
              time: `${s.startTime || ''} - ${s.endTime || ''}`,
              location: s.location || 'Propaganda Restaurant Al Bateen Park Plaza',
              status: (s.status === 'Swapped' ? 'Swap Requested' : 'Assigned') as ShiftItem['status'],
            }));
            setShifts(mapped);
          }
        }
      }
    } catch (error) {
      console.log('Failed to load shifts from cloud/storage', error);
    }
  };

  const handleRequestSwap = async (id: string) => {
    const currentReason = swapReasons[id] || '';
    if (!currentReason) {
      Alert.alert(
        currentLang === 'ar' ? 'خطأ' : 'Error',
        currentLang === 'ar' ? 'يرجى إدخال السبب أو الزميل للتبديل الوردية!' : 'Please enter a reason or target employee for the shift swap.'
      );
      return;
    }

    const updated = shifts.map((shift) => {
      if (shift.id === id) {
        return { ...shift, status: 'Swap Requested' as const };
      }
      return shift;
    });

    setShifts(updated);

    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const resolvedEmail = activeEmail ? activeEmail.trim().toLowerCase() : 'fahadmukasa74@gmail.com';
      const cleanId = userUniqueId.replace('#', '');

      await AsyncStorage.setItem(`@shift_${resolvedEmail}_${cleanId}`, JSON.stringify(updated));

      // --- SYNC SWAP REQUEST TO SUPABASE CLOUD ---
      const { error: cloudError } = await supabase.from('shifts').update({
        status: 'Swap Requested',
      }).eq('id', id);

      if (cloudError) {
        console.log('Supabase shift swap sync notice:', cloudError.message);
      }
    } catch (e) {
      console.log('Failed to save swap request to cloud/storage', e);
    }

    setSwapReasons({ ...swapReasons, [id]: '' });
    Alert.alert(
      currentLang === 'ar' ? 'تم إرسال الطلب' : 'Request Sent',
      currentLang === 'ar' ? 'تم تقديم طلب تبديل الوردية إلى المدير للموافقة عليه ومزامنته سحابياً.' : 'Shift change/swap request submitted to manager & synced to cloud.'
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction: currentLang === 'ar' ? 'rtl' : 'ltr' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{t.back}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.shifts}</Text>
        </View>

        <View style={styles.tabRow}>
          {[
            { key: 'Daily', label: t.dailyView },
            { key: 'Weekly', label: t.weeklyView },
            { key: 'Monthly', label: t.monthlyView },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.shifts} ({activeTab})</Text>
          <Text style={styles.subText}>
            {t.portalTitle} <Text style={styles.idHighlightText}>ID: {userUniqueId}</Text>
          </Text>

          {shifts.length === 0 ? (
            <Text style={styles.noShiftsText}>No shifts currently assigned.</Text>
          ) : (
            shifts.map((shift) => (
              <View key={shift.id} style={styles.shiftItemBox}>
                <View style={styles.shiftHeaderRow}>
                  <Text style={styles.shiftDate}>{shift.date}</Text>
                  <Text
                    style={[
                      styles.statusBadge,
                      shift.status === 'Assigned' ? styles.badgeAssigned : styles.badgeRequested,
                    ]}
                  >
                    {shift.status === 'Assigned'
                      ? currentLang === 'ar'
                        ? 'معين'
                        : 'Assigned'
                      : currentLang === 'ar'
                      ? 'تم طلب التبديل'
                      : 'Swap Requested'}
                  </Text>
                </View>
                <Text style={styles.shiftTime}>{shift.time}</Text>
                <Text style={styles.shiftLocation}>{shift.location}</Text>

                {shift.status === 'Assigned' && (
                  <View style={styles.swapSection}>
                    <TextInput
                      style={styles.swapInput}
                      placeholder={
                        currentLang === 'ar'
                          ? 'السبب أو اسم الزميل لتبديل الوردية'
                          : 'Reason or Colleague for Swap'
                      }
                      placeholderTextColor="#9ca3af"
                      value={swapReasons[shift.id] || ''}
                      onChangeText={(text) => setSwapReasons({ ...swapReasons, [shift.id]: text })}
                    />
                    <TouchableOpacity
                      style={styles.swapButton}
                      onPress={() => handleRequestSwap(shift.id)}
                    >
                      <Text style={styles.swapButtonText}>{t.requestSwap}</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  tabRow: { flexDirection: 'row', width: '100%', maxWidth: 550, marginBottom: 16, gap: 8 },
  tabButton: { flex: 1, backgroundColor: '#1e3a4c', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#0f766e' },
  tabButtonText: { color: '#cbd5e1', fontWeight: 'bold', fontSize: 14 },
  tabButtonTextActive: { color: '#ffffff' },
  card: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  subText: { fontSize: 13, color: '#64748b', marginBottom: 16 },
  idHighlightText: { color: '#2b5267', fontWeight: 'bold' },
  noShiftsText: { color: '#64748b', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  shiftItemBox: { backgroundColor: '#f1f5f9', borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#2b5267' },
  shiftHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  shiftDate: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  statusBadge: { fontSize: 12, fontWeight: 'bold', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, overflow: 'hidden', color: '#ffffff' },
  badgeAssigned: { backgroundColor: '#0f766e' },
  badgeRequested: { backgroundColor: '#b45309' },
  shiftTime: { fontSize: 14, color: '#334155', fontWeight: '600', marginBottom: 4 },
  shiftLocation: { fontSize: 13, color: '#475569', marginBottom: 12 },
  swapSection: { borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 10, gap: 8 },
  swapInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: '#1e293b' },
  swapButton: { backgroundColor: '#2b5267', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  swapButtonText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});