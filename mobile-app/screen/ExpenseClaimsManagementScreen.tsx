import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

interface ExpenseClaimItem {
  id: string;
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  title: string;
  amount: string | number;
  category: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

interface ExpenseClaimsManagementScreenProps {
  onBack: () => void;
  currentLang?: 'en' | 'ar';
}

export default function ExpenseClaimsManagementScreen({
  onBack,
  currentLang = 'en',
}: ExpenseClaimsManagementScreenProps) {
  const [claims, setClaims] = useState<ExpenseClaimItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  const isRTL = currentLang === 'ar';

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    loadAllEmployeeClaims();
    const interval = setInterval(loadAllEmployeeClaims, 3000);
    return () => {
      subscription?.remove();
      clearInterval(interval);
    };
  }, []);

  const loadAllEmployeeClaims = async () => {
    try {
      let fetchedClaims: ExpenseClaimItem[] = [];

      // --- 1. TRY FETCHING FROM SUPABASE CLOUD ---
      const { data: cloudData, error: cloudError } = await supabase
        .from('expense_claims')
        .select('*');

      if (!cloudError && cloudData && cloudData.length > 0) {
        fetchedClaims = cloudData.map((c: any) => ({
          id: c.id ? c.id.toString() : `exp-${Math.random()}`,
          employeeId: c.employee_id ? `#${c.employee_id.replace('#', '')}` : '#1945',
          employeeName: c.employee_name || 'Staff Member',
          employeeEmail: c.employee_email || '',
          title: c.title,
          amount: c.amount ? c.amount.toString() : '0',
          category: c.category || 'General',
          date: c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Today',
          status: c.status || 'Pending',
        }));
      }

      // --- 2. FALLBACK TO LOCAL STORAGE CACHE IF CLOUD IS EMPTY ---
      const savedList = await AsyncStorage.getItem('@management_expense_claims');
      if (savedList) {
        const localClaims: ExpenseClaimItem[] = JSON.parse(savedList);
        // Merge local claims with cloud claims to ensure nothing is missed
        const combined = [...fetchedClaims];
        localClaims.forEach((local) => {
          if (!combined.some((c) => c.id === local.id || c.title === local.title)) {
            combined.push(local);
          }
        });
        fetchedClaims = combined;
      }

      setClaims(fetchedClaims);
    } catch (error) {
      console.log('Failed to load management expense claims:', error);
    }
  };

  const updateClaimStatus = async (claimId: string, newStatus: 'Approved' | 'Rejected') => {
    try {
      // Update Supabase Cloud if online
      await supabase
        .from('expense_claims')
        .update({ status: newStatus })
        .eq('id', claimId);

      // Update local state & storage cache
      const updatedList = claims.map((c) => (c.id === claimId ? { ...c, status: newStatus } : c));
      setClaims(updatedList);
      await AsyncStorage.setItem('@management_expense_claims', JSON.stringify(updatedList));

      Alert.alert(
        isRTL ? 'تحديث الحالة' : 'Status Updated',
        isRTL ? `تمت الموافقة/الرفض بنجاح.` : `Expense claim status updated to ${newStatus}.`
      );
    } catch (error) {
      console.log('Failed to update claim status:', error);
    }
  };

  const filteredClaims = claims.filter((item) => {
    const matchesSearch =
      (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.employeeName && item.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.employeeId && item.employeeId.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = selectedStatusFilter === 'All' || item.status === selectedStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const isDesktop = windowWidth > 900;

  return (
    <SafeAreaView style={[styles.safeArea, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>
              {isRTL ? 'العودة إلى لوحة التحكم' : '← Back to Dashboard'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'إدارة مطالبات النفقات' : 'Expense Claims Management'}
          </Text>
        </View>

        {/* Search & Filter Card */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, isRTL && { textAlign: 'right' }]}>
            {isRTL ? 'تصفية وبحث المطالبات' : 'Search & Filter Claims'}
          </Text>

          <TextInput
            style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
            placeholder={
              isRTL
                ? 'البحث باسم الموظف أو المعرف أو العنوان...'
                : 'Search by employee name, ID, or title...'
            }
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.pill, selectedStatusFilter === status && styles.pillActive]}
                onPress={() => setSelectedStatusFilter(status)}
              >
                <Text
                  style={[styles.pillText, selectedStatusFilter === status && styles.pillTextActive]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Claims List Grid */}
        <View style={[styles.gridContainer, isDesktop && styles.gridContainerDesktop]}>
          {filteredClaims.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={[styles.emptyText, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'لا توجد مطالبات نفقات مطابقة.' : 'No expense claims found matching filter.'}
              </Text>
            </View>
          ) : (
            filteredClaims.map((item) => (
              <View
                key={item.id}
                style={[styles.claimCard, isDesktop && styles.claimCardDesktop]}
              >
                <View style={[styles.claimTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.employeeNameText, isRTL && { textAlign: 'right' }]}>
                      {item.employeeName || 'Staff Member'}{' '}
                      <Text style={styles.idText}>ID: {item.employeeId || '#1945'}</Text>
                    </Text>
                    <Text style={[styles.expenseTitleText, isRTL && { textAlign: 'right' }]}>
                      {item.title}
                    </Text>
                  </View>
                  <Text style={styles.amountText}>AED {item.amount}</Text>
                </View>

                <View style={[styles.claimMetaRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={styles.metaText}>
                    {item.category} • {item.date}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      item.status === 'Approved'
                        ? styles.badgeApproved
                        : item.status === 'Rejected'
                        ? styles.badgeRejected
                        : styles.badgePending,
                    ]}
                  >
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>

                {item.status === 'Pending' && (
                  <View style={[styles.actionBtnRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => updateClaimStatus(item.id, 'Approved')}
                    >
                      <Text style={styles.btnText}>{isRTL ? 'موافقة' : 'Approve'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => updateClaimStatus(item.id, 'Rejected')}
                    >
                      <Text style={styles.btnText}>{isRTL ? 'رفض' : 'Reject'}</Text>
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
  container: { flexGrow: 1, padding: 16, width: '100%', maxWidth: 900, alignSelf: 'center', paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 16, marginTop: 10 },
  backButton: { backgroundColor: '#1e3a4c', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  backButtonText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  card: { backgroundColor: '#12202a', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#1e3a4c' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 14 },
  searchInput: { backgroundColor: '#162833', borderWidth: 1, borderColor: '#1e3a4c', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#ffffff', marginBottom: 14 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 14, backgroundColor: '#162833', borderWidth: 1, borderColor: '#1e3a4c' },
  pillActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  pillText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#ffffff', fontWeight: 'bold' },
  gridContainer: { width: '100%', gap: 14 },
  gridContainerDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  emptyCard: { width: '100%', backgroundColor: '#12202a', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#1e3a4c' },
  emptyText: { color: '#94a3b8', fontSize: 14, fontStyle: 'italic' },
  claimCard: { width: '100%', backgroundColor: '#12202a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1e3a4c', marginBottom: 12 },
  claimCardDesktop: { width: '48%', minWidth: 400, flexGrow: 1 },
  claimTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  employeeNameText: { fontSize: 13, color: '#94a3b8', fontWeight: '600', marginBottom: 2 },
  idText: { color: '#f59e0b', fontWeight: 'bold' },
  expenseTitleText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  amountText: { fontSize: 18, fontWeight: 'bold', color: '#38bdf8' },
  claimMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metaText: { fontSize: 12, color: '#94a3b8' },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  badgePending: { backgroundColor: '#78350f' },
  badgeApproved: { backgroundColor: '#065f46' },
  badgeRejected: { backgroundColor: '#991b1b' },
  statusText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  actionBtnRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#1e3a4c', paddingTop: 12, marginTop: 4 },
  approveBtn: { flex: 1, backgroundColor: '#065f46', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: '#991b1b', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  btnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});