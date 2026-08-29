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

interface ExpenseItem {
  id: string;
  title: string;
  amount: string;
  category: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  employeeName?: string;
  employeeId?: string;
}

interface ExpenseClaimScreenProps {
  onBack: () => void;
  currentLang?: 'en' | 'ar';
}

export default function ExpenseClaimScreen({ onBack, currentLang = 'en' }: ExpenseClaimScreenProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Travel');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [userKeyData, setUserKeyData] = useState<{ email: string; id: string; name: string } | null>(null);

  useEffect(() => {
    loadExpenses();
    const interval = setInterval(loadExpenses, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadExpenses = async () => {
    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const userKey = (activeEmail || 'fahadmukasa74@gmail.com').trim().toLowerCase();
      
      const savedId = await AsyncStorage.getItem(`@user_unique_id_${userKey}`) || await AsyncStorage.getItem('@user_unique_id');
      const resolvedId = savedId || (userKey.includes('omega') ? '#7229' : '#1945');
      const cleanId = resolvedId.replace('#', '');

      const savedName = await AsyncStorage.getItem(`@full_name_${userKey}`);
      const resolvedName = savedName || (userKey.includes('omega') ? 'OMEGA 256' : 'FAHAD MUKASA');

      setUserKeyData({ email: userKey, id: cleanId, name: resolvedName });

      let cloudLoaded = false;
      let fetchedClaims: ExpenseItem[] = [];

      // --- FETCH EXPENSE CLAIMS FROM SUPABASE CLOUD ---
      const { data: cloudData, error: cloudError } = await supabase
        .from('expense_claims')
        .select('*');

      if (!cloudError && cloudData && cloudData.length > 0) {
        const filtered = cloudData.filter((item: any) => {
          const itemEmail = (item.employee_email || '').trim().toLowerCase();
          const itemId = (item.employee_id || '').replace('#', '');
          return itemEmail === userKey || itemId === cleanId;
        });

        if (filtered.length > 0) {
          cloudLoaded = true;
          fetchedClaims = filtered.map((c: any) => ({
            id: c.id ? c.id.toString() : `exp-${Math.random()}`,
            title: c.title,
            amount: c.amount ? c.amount.toString() : '0',
            category: c.category || 'General',
            date: c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Today',
            status: c.status || 'Pending',
            employeeName: c.employee_name || resolvedName,
            employeeId: c.employee_id || cleanId,
          }));
          setExpenses(fetchedClaims);
        }
      }

      // Fallback to local storage if cloud is empty or offline
      if (!cloudLoaded && userKey && cleanId) {
        const localKey = `@expense_claims_${userKey}_${cleanId}`;
        const localData = await AsyncStorage.getItem(localKey);
        if (localData) {
          setExpenses(JSON.parse(localData));
        }
      }
    } catch (error) {
      console.log('Failed to load expense claims:', error);
    }
  };

  const handleSubmitedClaim = async () => {
    if (!title.trim() || !amount.trim()) {
      Alert.alert(
        currentLang === 'ar' ? 'خطأ' : 'Error',
        currentLang === 'ar' ? 'يرجى إدخال عنوان النفقات والمبلغ!' : 'Please enter an expense title and amount.'
      );
      return;
    }

    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const userKey = (activeEmail || 'fahadmukasa74@gmail.com').trim().toLowerCase();
      const savedId = await AsyncStorage.getItem(`@user_unique_id_${userKey}`) || await AsyncStorage.getItem('@user_unique_id');
      const resolvedId = savedId || (userKey.includes('omega') ? '#7229' : '#1945');
      const cleanId = resolvedId.replace('#', '');

      const savedName = await AsyncStorage.getItem(`@full_name_${userKey}`);
      const resolvedName = savedName || (userKey.includes('omega') ? 'OMEGA 256' : 'FAHAD MUKASA');

      const generatedUniqueId = `exp-${Date.now()}`;

      // --- SYNC TO SUPABASE CLOUD WITH EXPLICIT ID ---
      const { error: cloudError } = await supabase
        .from('expense_claims')
        .insert([
          {
            id: generatedUniqueId,
            employee_email: userKey,
            employee_id: cleanId,
            employee_name: resolvedName,
            title: title.trim(),
            amount: parseFloat(amount),
            category: category,
            status: 'Pending',
          },
        ]);

      if (cloudError) {
        console.log('Supabase cloud insert error:', cloudError.message);
        Alert.alert('Database Notice', `Could not sync to cloud: ${cloudError.message}`);
        return;
      }

      const newClaim: ExpenseItem = {
        id: generatedUniqueId,
        title: title.trim(),
        amount: amount.trim(),
        category,
        date: new Date().toLocaleDateString(),
        status: 'Pending',
        employeeName: resolvedName,
        employeeId: cleanId,
      };

      const updatedList = [newClaim, ...expenses];
      setExpenses(updatedList);

      // Save to local storage cache
      if (userKey && cleanId) {
        await AsyncStorage.setItem(`@expense_claims_${userKey}_${cleanId}`, JSON.stringify(updatedList));
      }

      // Also append to global management cache so admin view picks it up instantly
      const existingGlobal = await AsyncStorage.getItem('@management_expense_claims');
      const globalList = existingGlobal ? JSON.parse(existingGlobal) : [];
      await AsyncStorage.setItem('@management_expense_claims', JSON.stringify([newClaim, ...globalList]));

      setTitle('');
      setAmount('');
      Alert.alert(
        currentLang === 'ar' ? 'تم الإرسال' : 'Claim Submitted',
        currentLang === 'ar' ? 'تم إرسال المطالبة المالية للموافقة تحت ملفك الشخصي.' : 'Your expense claim has been successfully submitted under your employee ID & name.'
      );
    } catch (e) {
      console.log('Failed to save expense claim:', e);
      Alert.alert('Error', 'An unexpected error occurred while submitting your claim.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>
              {currentLang === 'ar' ? 'العودة' : 'Back to Menu'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentLang === 'ar' ? 'مطالبات النفقات' : 'Expense Claims'}
          </Text>
        </View>

        {/* New Claim Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {currentLang === 'ar' ? 'تقديم مطالبة جديدة' : 'Submit New Expense'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder={currentLang === 'ar' ? 'عنوان النفقات (مثل: عشاء عميل)' : 'Expense Title (e.g., Client Dinner)'}
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={styles.input}
            placeholder={currentLang === 'ar' ? 'المبلغ (د.إ)' : 'Amount (AED)'}
            placeholderTextColor="#9ca3af"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

          <View style={styles.categoryRow}>
            {['Travel', 'Meals', 'Supplies'].map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, category === cat && styles.catChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmitedClaim}>
            <Text style={styles.submitButtonText}>
              {currentLang === 'ar' ? 'إرسال للموافقة' : 'Submit Claim'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* History List */}
        <Text style={styles.sectionHeading}>
          {currentLang === 'ar' ? 'سجل المطالبات' : 'Claim History'}
        </Text>

        {expenses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {currentLang === 'ar' ? 'لا توجد مطالبات سابقة.' : 'No expense claims submitted yet.'}
            </Text>
          </View>
        ) : (
          expenses.map((item) => (
            <View key={item.id} style={styles.expenseCard}>
              <View style={styles.expenseHeader}>
                <Text style={styles.expenseTitle}>{item.title}</Text>
                <Text style={styles.expenseAmount}>AED {item.amount}</Text>
              </View>
              <View style={styles.expenseFooter}>
                <Text style={styles.expenseCategory}>{item.category} • {item.date}</Text>
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
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2b5267' },
  container: { flexGrow: 1, padding: 16, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 16, marginTop: 10 },
  backButton: { backgroundColor: '#1e3a4c', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  backButtonText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  card: { backgroundColor: '#12202a', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#1e3a4c' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', marginBottom: 14 },
  input: { backgroundColor: '#162833', borderWidth: 1, borderColor: '#1e3a4c', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#ffffff', marginBottom: 12 },
  categoryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  catChip: { flex: 1, backgroundColor: '#162833', paddingVertical: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#1e3a4c' },
  catChipActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  catText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  catTextActive: { color: '#ffffff' },
  submitButton: { backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  sectionHeading: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 12 },
  emptyCard: { backgroundColor: '#12202a', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#1e3a4c' },
  emptyText: { color: '#94a3b8', fontSize: 14, fontStyle: 'italic' },
  expenseCard: { backgroundColor: '#12202a', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1e3a4c' },
  expenseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  expenseTitle: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#38bdf8' },
  expenseFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  expenseCategory: { fontSize: 12, color: '#94a3b8' },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6 },
  badgePending: { backgroundColor: '#78350f' },
  badgeApproved: { backgroundColor: '#065f46' },
  badgeRejected: { backgroundColor: '#991b1b' },
  statusText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
});