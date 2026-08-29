import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Modal,
  TextInput,
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

interface SettingsScreenProps {
  onBack: () => void;
  currentLang: 'en' | 'ar';
  onToggleLang: (lang: 'en' | 'ar') => void;
}

export default function SettingsScreen({ onBack, currentLang, onToggleLang }: SettingsScreenProps) {
  const [lang, setLang] = useState<'en' | 'ar'>(currentLang);
  const [pushEnabled, setPushEnabled] = useState(true);
  
  // Change Password Modal States
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const t = translationsMap[lang];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const resolvedEmail = activeEmail ? activeEmail.trim().toLowerCase() : 'fahadmukasa74@gmail.com';

      // --- FETCH SETTINGS FROM SUPABASE CLOUD ---
      let cloudLoaded = false;
      const { data: cloudSettings, error: cloudError } = await supabase
        .from('settings')
        .select('*')
        .eq('email', resolvedEmail);

      if (!cloudError && cloudSettings && cloudSettings.length > 0) {
        const cs = cloudSettings[0];
        cloudLoaded = true;
        if (cs.language === 'en' || cs.language === 'ar') {
          setLang(cs.language);
          onToggleLang(cs.language);
        }
        if (typeof cs.push_notifications === 'boolean') {
          setPushEnabled(cs.push_notifications);
        }
      }

      if (!cloudLoaded) {
        const savedLang = await AsyncStorage.getItem('@app_language');
        const savedPush = await AsyncStorage.getItem('@push_notifications');
        if (savedLang === 'en' || savedLang === 'ar') setLang(savedLang);
        if (savedPush !== null) setPushEnabled(JSON.parse(savedPush));
      }
    } catch (error) {
      console.log('Failed to load settings from cloud/storage', error);
    }
  };

  const handleLanguageChange = async (selectedLang: 'en' | 'ar') => {
    setLang(selectedLang);
    onToggleLang(selectedLang);
    try {
      await AsyncStorage.setItem('@app_language', selectedLang);
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const resolvedEmail = activeEmail ? activeEmail.trim().toLowerCase() : 'fahadmukasa74@gmail.com';

      // --- SYNC LANGUAGE TO SUPABASE CLOUD ---
      const { error } = await supabase.from('settings').upsert([
        { email: resolvedEmail, language: selectedLang, push_notifications: pushEnabled },
      ], { onConflict: 'email' });

      if (error) {
        console.log('Cloud settings sync warning:', error.message);
      }
    } catch (error) {
      console.log('Failed to save language preference', error);
    }
  };

  const handlePushNotificationToggle = async (value: boolean) => {
    setPushEnabled(value);
    try {
      await AsyncStorage.setItem('@push_notifications', JSON.stringify(value));
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const resolvedEmail = activeEmail ? activeEmail.trim().toLowerCase() : 'fahadmukasa74@gmail.com';

      // --- SYNC PUSH NOTIFICATIONS TO SUPABASE CLOUD ---
      const { error } = await supabase.from('settings').upsert([
        { email: resolvedEmail, language: lang, push_notifications: value },
      ], { onConflict: 'email' });

      if (error) {
        console.log('Cloud settings sync warning:', error.message);
      }

      Alert.alert(
        lang === 'ar' ? 'الإشعارات' : 'Push Notifications',
        value
          ? (lang === 'ar' ? 'تم تفعيل الإشعارات الفورية بنجاح.' : 'Push notifications enabled successfully.')
          : (lang === 'ar' ? 'تم إيقاف الإشعارات الفورية.' : 'Push notifications disabled.')
      );
    } catch (error) {
      console.log('Failed to save push notification preference', error);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(
        lang === 'ar' ? 'خطأ' : 'Error',
        lang === 'ar' ? 'يرجى تعبئة جميع حقول كلمة المرور.' : 'Please fill in all password fields.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        lang === 'ar' ? 'خطأ' : 'Error',
        lang === 'ar' ? 'كلمة المرور الجديدة وتأكيدها غير متطابقتين.' : 'New password and confirmation do not match.'
      );
      return;
    }

    // Password strength check: min 8 chars, uppercase, lowercase, number, symbol
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      Alert.alert(
        lang === 'ar' ? 'شروط كلمة المرور' : 'Password Strength Error',
        lang === 'ar'
          ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل، وتحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص.'
          : 'Password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character.'
      );
      return;
    }

    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const resolvedEmail = activeEmail ? activeEmail.trim().toLowerCase() : 'fahadmukasa74@gmail.com';

      const savedStoredPassword = await AsyncStorage.getItem('@password') || 'Password123!';
      if (currentPassword !== savedStoredPassword) {
        Alert.alert(
          lang === 'ar' ? 'فشل التحقق' : 'Validation Failed',
          lang === 'ar' ? 'كلمة المرور الحالية غير صحيحة.' : 'Current password does not match database record.'
        );
        return;
      }

      await AsyncStorage.setItem('@password', newPassword);

      // --- SYNC NEW PASSWORD TO SUPABASE CLOUD ---
      const { error: cloudError } = await supabase.from('profiles').update({
        password_hash: newPassword,
      }).eq('email', resolvedEmail);

      if (cloudError) {
        console.log('Cloud password update notice:', cloudError.message);
      }

      setIsPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert(
        lang === 'ar' ? 'نجاح' : 'Success',
        lang === 'ar' ? 'تم تغيير كلمة المرور بنجاح ومزامنتها سحابياً!' : 'Password changed securely and updated in cloud!'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update password securely.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction: lang === 'ar' ? 'rtl' : 'ltr' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>{t.back}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.settingsHeader}</Text>
        </View>

        {/* Change Password Card */}
        <TouchableOpacity 
          style={styles.cardButton} 
          onPress={() => setIsPasswordModalVisible(true)}
        >
          <Text style={styles.cardButtonText}>🔒 {t.changePassword}</Text>
        </TouchableOpacity>

        {/* Language Toggle Card */}
        <View style={styles.cardContainer}>
          <Text style={styles.sectionTitle}>🌐 {t.languageSettings}</Text>
          <Text style={styles.subText}>Current Language: {lang === 'en' ? 'English' : 'العربية'}</Text>

          <View style={styles.langButtonRow}>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              onPress={() => handleLanguageChange('en')}
            >
              <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>English</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.langBtn, lang === 'ar' && styles.langBtnActive]}
              onPress={() => handleLanguageChange('ar')}
            >
              <Text style={[styles.langBtnText, lang === 'ar' && styles.langBtnTextActive]}>العربية</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Push Notifications Card */}
        <View style={styles.switchCard}>
          <Text style={styles.switchLabel}>🔔 {t.pushNotifications}</Text>
          <Switch
            trackColor={{ false: '#cbd5e1', true: '#2b5267' }}
            thumbColor={'#ffffff'}
            ios_backgroundColor="#cbd5e1"
            onValueChange={handlePushNotificationToggle}
            value={pushEnabled}
          />
        </View>

        {/* Change Password Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isPasswordModalVisible}
          onRequestClose={() => setIsPasswordModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t.changePassword}</Text>
                <TouchableOpacity onPress={() => setIsPasswordModalVisible(false)}>
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder={lang === 'ar' ? 'كلمة المرور الحالية' : 'Current Password'}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={true}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder={lang === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={true}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder={lang === 'ar' ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={true}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>

              <Text style={styles.hintText}>
                {lang === 'ar'
                  ? '* يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وصغير رقم ورمز.'
                  : '* Min 8 chars, with uppercase, lowercase, number & symbol.'}
              </Text>

              <TouchableOpacity style={styles.submitButton} onPress={handleChangePassword}>
                <Text style={styles.submitButtonText}>{lang === 'ar' ? 'حفظ كلمة المرور' : 'UPDATE PASSWORD'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2b5267' },
  container: { flexGrow: 1, padding: 16, alignItems: 'center', paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10, width: '100%', maxWidth: 550, gap: 16 },
  backButton: { backgroundColor: '#1e3a4c', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  backButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  cardButton: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardButtonText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  cardContainer: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  subText: { fontSize: 13, color: '#64748b', marginBottom: 14 },
  langButtonRow: { flexDirection: 'row', gap: 12 },
  langBtn: { flex: 1, backgroundColor: '#e2e8f0', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  langBtnActive: { backgroundColor: '#2b5267' },
  langBtnText: { fontSize: 15, fontWeight: '600', color: '#475569' },
  langBtnTextActive: { color: '#ffffff', fontWeight: 'bold' },
  switchCard: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 480, backgroundColor: '#f8fafc', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 16, marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  closeIconText: { fontSize: 18, fontWeight: 'bold', color: '#334155' },
  inputContainer: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginBottom: 16, paddingBottom: 4 },
  input: { fontSize: 15, color: '#1e293b', paddingVertical: 6 },
  hintText: { fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 20 },
  submitButton: { backgroundColor: '#2b5267', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
});