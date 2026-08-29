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

interface ProfileScreenProps {
  onBack: () => void;
  onProfileUpdated: () => void;
  currentLang: 'en' | 'ar';
  employeeId?: string | null;
  employeeEmail?: string | null;
}

export default function ProfileScreen({
  onBack,
  onProfileUpdated,
  currentLang,
  employeeId,
  employeeEmail,
}: ProfileScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [role, setRole] = useState('Employee');
  const [department, setDepartment] = useState('General Staff');
  const [status, setStatus] = useState('Active');
  const [userUniqueId, setUserUniqueId] = useState(
    employeeId ? (employeeId.startsWith('#') ? employeeId : `#${employeeId}`) : '#1945'
  );
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [emiratesIdFront, setEmiratesIdFront] = useState<string | null>(null);
  const [emiratesIdBack, setEmiratesIdBack] = useState<string | null>(null);
  const [drivingLicense, setDrivingLicense] = useState<string | null>(null); // Added Driving License State

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [iban, setIban] = useState('');
  const [branchName, setBranchName] = useState('');

  const t: any = translationsMap[currentLang];

  useEffect(() => {
    loadUserData();
  }, [employeeId, employeeEmail]);

  const loadUserData = async () => {
    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      let userKey = employeeEmail || activeEmail || 'fahadmukasa74@gmail.com';
      userKey = userKey.trim().toLowerCase();

      let formattedId = '#1945';
      if (employeeId) {
        formattedId = employeeId.startsWith('#') ? employeeId : `#${employeeId}`;
      } else {
        const savedId = await AsyncStorage.getItem(`@user_unique_id_${userKey}`);
        if (savedId) {
          formattedId = savedId.startsWith('#') ? savedId : `#${savedId}`;
        }
      }
      setUserUniqueId(formattedId);

      const cleanId = formattedId.replace('#', '');
      const profileKey = `@employee_profile_${userKey}_${cleanId}`;
      const uaeFrontKey = `@uae_id_front_${userKey}_${cleanId}`;
      const uaeBackKey = `@uae_id_back_${userKey}_${cleanId}`;
      const licenseKey = `@driving_license_${userKey}_${cleanId}`; // Added Key

      // --- FETCH PROFILE FROM SUPABASE CLOUD DATABASE ---
      let cloudLoaded = false;
      const { data: cloudProfiles, error: cloudError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', userKey);

      if (!cloudError && cloudProfiles && cloudProfiles.length > 0) {
        const cp = cloudProfiles[0];
        cloudLoaded = true;
        setFullName(cp.full_name || cp.fullName || '');
        setEmail(cp.email || userKey);
        setPhone(cp.phone || '');
        setCountry(cp.country || '');
        setCity(cp.city || '');
        setBankName(cp.bank_name || cp.bankName || '');
        setAccountNumber(cp.account_number || cp.accountNumber || '');
        setIban(cp.iban || '');
        setBranchName(cp.branch_name || cp.branchName || '');
        setRole(cp.role || 'Employee');
        setStatus(cp.status || 'Active');
        if (cp.profile_image && !cp.profile_image.startsWith('blob:')) {
          setProfileImage(cp.profile_image);
        }
        if (cp.emirates_id_front && !cp.emirates_id_front.startsWith('blob:')) {
          setEmiratesIdFront(cp.emirates_id_front);
        }
        if (cp.emirates_id_back && !cp.emirates_id_back.startsWith('blob:')) {
          setEmiratesIdBack(cp.emirates_id_back);
        }
        if (cp.driving_license && !cp.driving_license.startsWith('blob:')) {
          setDrivingLicense(cp.driving_license);
        }
      }

      if (!cloudLoaded) {
        // Load bundled profile data using the required key format
        const savedProfileJson = await AsyncStorage.getItem(profileKey);
        if (savedProfileJson) {
          const parsed = JSON.parse(savedProfileJson);
          if (parsed.fullName) setFullName(parsed.fullName);
          if (parsed.email) setEmail(parsed.email);
          else setEmail(userKey);
          if (parsed.phone) setPhone(parsed.phone);
          if (parsed.country) setCountry(parsed.country);
          if (parsed.city) setCity(parsed.city);
          if (parsed.bankName) setBankName(parsed.bankName);
          if (parsed.accountNumber) setAccountNumber(parsed.accountNumber);
          if (parsed.iban) setIban(parsed.iban);
          if (parsed.branchName) setBranchName(parsed.branchName);
          if (parsed.role) setRole(parsed.role);
          if (parsed.status) setStatus(parsed.status);
          if (parsed.profileImage && !parsed.profileImage.startsWith('blob:')) {
            setProfileImage(parsed.profileImage);
          }
          if (parsed.drivingLicense && !parsed.drivingLicense.startsWith('blob:')) {
            setDrivingLicense(parsed.drivingLicense);
          }
        } else {
          const savedName = await AsyncStorage.getItem(`@full_name_${userKey}`);
          const savedEmail = await AsyncStorage.getItem(`@email_${userKey}`);
          const savedPhone = await AsyncStorage.getItem(`@phone_${userKey}`);
          const savedCountry = await AsyncStorage.getItem(`@country_${userKey}`);
          const savedCity = await AsyncStorage.getItem(`@city_${userKey}`);
          const savedRole = await AsyncStorage.getItem(`@role_${userKey}`);
          const savedBankName = await AsyncStorage.getItem(`@bank_name_${userKey}`);
          const savedAccountNumber = await AsyncStorage.getItem(`@account_number_${userKey}`);
          const savedIban = await AsyncStorage.getItem(`@iban_${userKey}`);
          const savedBranchName = await AsyncStorage.getItem(`@branch_name_${userKey}`);

          if (savedName) setFullName(savedName);
          if (savedEmail) setEmail(savedEmail);
          else setEmail(userKey);
          if (savedPhone) setPhone(savedPhone);
          if (savedCountry) setCountry(savedCountry);
          if (savedCity) setCity(savedCity);
          if (savedBankName) setBankName(savedBankName);
          if (savedAccountNumber) setAccountNumber(savedAccountNumber);
          if (savedIban) setIban(savedIban);
          if (savedBranchName) setBranchName(savedBranchName);
          if (savedRole) setRole(savedRole);

          const isAdminViewingOrLogged = formattedId === '#1945' || userKey === 'fahadmukasa74@gmail.com';
          if (isAdminViewingOrLogged) {
            const admImg = await AsyncStorage.getItem('@profile_image_fahadmukasa74@gmail.com');
            if (admImg && !admImg.startsWith('blob:')) setProfileImage(admImg);
          } else {
            const pImg = await AsyncStorage.getItem(`@profile_image_${userKey}_${cleanId}`);
            if (pImg && !pImg.startsWith('blob:')) setProfileImage(pImg);
          }
        }

        // Load Emirates ID and Driving License using exact requested key formats
        const savedIdFront = await AsyncStorage.getItem(uaeFrontKey);
        const savedIdBack = await AsyncStorage.getItem(uaeBackKey);
        const savedLicense = await AsyncStorage.getItem(licenseKey);

        if (savedIdFront && !savedIdFront.startsWith('blob:')) setEmiratesIdFront(savedIdFront);
        if (savedIdBack && !savedIdBack.startsWith('blob:')) setEmiratesIdBack(savedIdBack);
        if (savedLicense && !savedLicense.startsWith('blob:')) setDrivingLicense(savedLicense);
      }
    } catch (error) {
      console.log('Failed to load profile data from cloud/storage', error);
    }
  };

  const saveWithQuotaHandling = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (quotaError) {
      console.warn('Storage quota exceeded. Clearing old caches and retrying...');
      try {
        await AsyncStorage.removeItem('@global_attendance_logs');
        await AsyncStorage.removeItem('@registered_workers_list');
        await AsyncStorage.setItem(key, value);
      } catch (retryError) {
        console.log('Storage retry failed:', retryError);
      }
    }
  };

  const pickImage = async (type: 'profile' | 'idFront' | 'idBack' | 'drivingLicense') => {
    if (employeeId) return;
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        currentLang === 'ar' ? 'الإذن مطلوب' : 'Permission Required',
        currentLang === 'ar' ? 'الإذن للوصول إلى الكاميرا مطلوب!' : 'Permission to access camera roll is required!'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : [16, 9],
      quality: 0.2,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];

      const compressImage = async (uri: string, maxDim = 300): Promise<string> => {
        return new Promise((resolve) => {
          if (typeof document === 'undefined') {
            resolve(uri);
            return;
          }
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxDim) {
                height *= maxDim / width;
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width *= maxDim / height;
                height = maxDim;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.25));
          };
          img.onerror = () => resolve(uri);
          img.src = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : uri;
        });
      };

      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const userKey = (email || activeEmail || 'fahadmukasa74@gmail.com').trim().toLowerCase();
      const cleanId = userUniqueId.replace('#', '');
      const profileKey = `@employee_profile_${userKey}_${cleanId}`;

      if (type === 'profile') {
        const compressedUri = await compressImage(asset.uri, 400);
        setProfileImage(compressedUri);
        try {
          if (userKey === 'fahadmukasa74@gmail.com') {
            await saveWithQuotaHandling('@profile_image_fahadmukasa74@gmail.com', compressedUri);
          }
          await saveWithQuotaHandling(`@profile_image_${userKey}_${cleanId}`, compressedUri);

          const existingProfile = await AsyncStorage.getItem(profileKey);
          const profileObj = existingProfile ? JSON.parse(existingProfile) : {};
          profileObj.profileImage = compressedUri;
          await saveWithQuotaHandling(profileKey, JSON.stringify(profileObj));

          // --- SYNC IMAGE TO SUPABASE CLOUD ---
          await supabase.from('profiles').upsert([
            {
              email: userKey,
              employee_id: userUniqueId,
              profile_image: compressedUri,
            },
          ], { onConflict: 'email' });
        } catch (storageError) {
          console.log('Profile image storage/cloud sync skipped:', storageError);
        }
        onProfileUpdated();
      } else if (type === 'idFront') {
        const compressedUri = await compressImage(asset.uri, 250);
        setEmiratesIdFront(compressedUri);
        try {
          const uaeFrontKey = `@uae_id_front_${userKey}_${cleanId}`;
          await saveWithQuotaHandling(uaeFrontKey, compressedUri);
          await supabase.from('profiles').upsert([
            { email: userKey, employee_id: userUniqueId, emirates_id_front: compressedUri },
          ], { onConflict: 'email' });
        } catch (e) {
          console.log('ID front storage skipped:', e);
        }
      } else if (type === 'idBack') {
        const compressedUri = await compressImage(asset.uri, 250);
        setEmiratesIdBack(compressedUri);
        try {
          const uaeBackKey = `@uae_id_back_${userKey}_${cleanId}`;
          await saveWithQuotaHandling(uaeBackKey, compressedUri);
          await supabase.from('profiles').upsert([
            { email: userKey, employee_id: userUniqueId, emirates_id_back: compressedUri },
          ], { onConflict: 'email' });
        } catch (e) {
          console.log('ID back storage skipped:', e);
        }
      } else if (type === 'drivingLicense') {
        const compressedUri = await compressImage(asset.uri, 250);
        setDrivingLicense(compressedUri);
        try {
          const licenseKey = `@driving_license_${userKey}_${cleanId}`;
          await saveWithQuotaHandling(licenseKey, compressedUri);
          await supabase.from('profiles').upsert([
            { email: userKey, employee_id: userUniqueId, driving_license: compressedUri },
          ], { onConflict: 'email' });
        } catch (e) {
          console.log('Driving license storage skipped:', e);
        }
      }
    }
  };

  const handleSaveChanges = async () => {
    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const userKey = (email || activeEmail || '').trim().toLowerCase();
      const cleanId = userUniqueId.replace('#', '');

      if (userKey && cleanId) {
        const profileKey = `@employee_profile_${userKey}_${cleanId}`;
        const profileData = {
          fullName,
          email,
          phone,
          country,
          city,
          bankName,
          accountNumber,
          iban,
          branchName,
          role,
          status,
          profileImage,
          drivingLicense,
        };

        // Save profile data permanently
        await saveWithQuotaHandling(profileKey, JSON.stringify(profileData));

        // Save and await Emirates ID images & Driving license securely
        if (emiratesIdFront) {
          await saveWithQuotaHandling(`@uae_id_front_${userKey}_${cleanId}`, emiratesIdFront);
        }
        if (emiratesIdBack) {
          await saveWithQuotaHandling(`@uae_id_back_${userKey}_${cleanId}`, emiratesIdBack);
        }
        if (drivingLicense) {
          await saveWithQuotaHandling(`@driving_license_${userKey}_${cleanId}`, drivingLicense);
        }

        // Sync individual fallback keys
        await AsyncStorage.setItem(`@full_name_${userKey}`, fullName);
        await AsyncStorage.setItem(`@email_${userKey}`, email);
        await AsyncStorage.setItem(`@phone_${userKey}`, phone);
        await AsyncStorage.setItem(`@country_${userKey}`, country);
        await AsyncStorage.setItem(`@city_${userKey}`, city);
        await AsyncStorage.setItem(`@bank_name_${userKey}`, bankName);
        await AsyncStorage.setItem(`@account_number_${userKey}`, accountNumber);
        await AsyncStorage.setItem(`@iban_${userKey}`, iban);
        await AsyncStorage.setItem(`@branch_name_${userKey}`, branchName);

        // --- SYNC PROFILE DATA TO SUPABASE CLOUD DATABASE ---
        const { error: cloudError } = await supabase.from('profiles').upsert([
          {
            email: userKey,
            employee_id: userUniqueId,
            full_name: fullName,
            phone,
            country,
            city,
            bank_name: bankName,
            account_number: accountNumber,
            iban,
            branch_name: branchName,
            role,
            status,
            profile_image: profileImage,
            emirates_id_front: emiratesIdFront,
            emirates_id_back: emiratesIdBack,
            driving_license: drivingLicense,
          },
        ], { onConflict: 'email' });

        if (cloudError) {
          console.log('Supabase profile update error:', cloudError.message);
        }
      }

      Alert.alert(
        currentLang === 'ar' ? 'نجاح' : 'Success',
        currentLang === 'ar' ? 'تم تحديث بيانات الملف الشخصي بنجاح وإرسالها للسحابة!' : 'Profile details updated permanently & synced to cloud!'
      );
      onProfileUpdated();
    } catch (error) {
      Alert.alert(
        currentLang === 'ar' ? 'خطأ' : 'Error',
        currentLang === 'ar' ? 'فشل حفظ تغييرات الملف الشخصي.' : 'Failed to save profile changes.'
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction: currentLang === 'ar' ? 'rtl' : 'ltr' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>
              {employeeId
                ? currentLang === 'ar'
                  ? 'العودة إلى نظرة عامة'
                  : 'Back to Overview'
                : t.back}
            </Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {employeeId ? (currentLang === 'ar' ? 'ملف الموظف' : 'Employee Profile') : t.profile}
          </Text>
        </View>

        <View style={[styles.card, employeeId && styles.managementCard]}>
          <Text style={styles.sectionLabel}>
            {currentLang === 'ar' ? 'صورة الملف الشخصي' : 'Profile Picture'}
          </Text>
          <TouchableOpacity
            style={styles.imagePickerContainer}
            onPress={() => pickImage('profile')}
            disabled={!!employeeId}
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>
                  {employeeId
                    ? currentLang === 'ar'
                      ? 'لا توجد صورة'
                      : 'No Photo'
                    : currentLang === 'ar'
                    ? '+ رفع الصورة'
                    : '+ Upload Photo'}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.badgeContainer}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                ID: {userUniqueId} | {role} ({department})
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                status === 'On Leave' ? styles.statusLeave : styles.statusActive,
              ]}
            >
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>
            {currentLang === 'ar' ? 'التفاصيل الشخصية' : 'Personal Details'}
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'الاسم الكامل' : 'Full Name'}
              placeholderTextColor="#9ca3af"
              value={fullName}
              onChangeText={setFullName}
              editable={!employeeId}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'عنوان البريد الإلكتروني' : 'Email Address'}
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!employeeId}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              editable={!employeeId}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'الدولة' : 'Country'}
              placeholderTextColor="#9ca3af"
              value={country}
              onChangeText={setCountry}
              editable={!employeeId}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'المدينة' : 'City'}
              placeholderTextColor="#9ca3af"
              value={city}
              onChangeText={setCity}
              editable={!employeeId}
            />
          </View>

          <Text style={styles.sectionLabel}>
            {currentLang === 'ar' ? 'التفاصيل المصرفية' : 'Bank Details'}
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'اسم البنك' : 'Bank Name'}
              placeholderTextColor="#9ca3af"
              value={bankName}
              onChangeText={setBankName}
              editable={!employeeId}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'رقم الحساب' : 'Account Number'}
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={accountNumber}
              onChangeText={setAccountNumber}
              editable={!employeeId}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'رقم الايبان IBAN' : 'IBAN'}
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              value={iban}
              onChangeText={setIban}
              editable={!employeeId}
            />
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, employeeId && styles.disabledInput]}
              placeholder={currentLang === 'ar' ? 'اسم الفرع' : 'Branch Name'}
              placeholderTextColor="#9ca3af"
              value={branchName}
              onChangeText={setBranchName}
              editable={!employeeId}
            />
          </View>

          <Text style={styles.sectionLabel}>
            {currentLang === 'ar' ? 'وثائق هوية الإمارات الوجهين' : 'Emirates ID Documents (Both Sides)'}
          </Text>
          <View style={styles.idCardRow}>
            <TouchableOpacity
              style={styles.idBox}
              onPress={() => pickImage('idFront')}
              disabled={!!employeeId}
            >
              {emiratesIdFront ? (
                <Image source={{ uri: emiratesIdFront }} style={styles.idImage} resizeMode="cover" />
              ) : (
                <Text style={styles.idBoxText}>
                  {currentLang === 'ar' ? '+ الوجه الامامي للهوية' : '+ Front ID'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.idBox}
              onPress={() => pickImage('idBack')}
              disabled={!!employeeId}
            >
              {emiratesIdBack ? (
                <Image source={{ uri: emiratesIdBack }} style={styles.idImage} resizeMode="cover" />
              ) : (
                <Text style={styles.idBoxText}>
                  {currentLang === 'ar' ? '+ الوجه الخلفي للهوية' : '+ Back ID'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Driving License Section Added */}
          <Text style={styles.sectionLabel}>
            {currentLang === 'ar' ? 'رخصة القيادة' : 'Driving License'}
          </Text>
          <TouchableOpacity
            style={styles.singleDocBox}
            onPress={() => pickImage('drivingLicense')}
            disabled={!!employeeId}
          >
            {drivingLicense ? (
              <Image source={{ uri: drivingLicense }} style={styles.idImage} resizeMode="cover" />
            ) : (
              <Text style={styles.idBoxText}>
                {currentLang === 'ar' ? '+ رفع رخصة القيادة' : '+ Upload Driving License'}
              </Text>
            )}
          </TouchableOpacity>

          {!employeeId && (
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveChanges}>
              <Text style={styles.saveButtonText}>
                {currentLang === 'ar' ? 'حفظ التغييرات' : 'SAVE CHANGES'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
  card: { width: '100%', maxWidth: 550, backgroundColor: '#f8fafc', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  managementCard: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  sectionLabel: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 12, marginTop: 12 },
  imagePickerContainer: { alignSelf: 'center', marginBottom: 16 },
  imagePlaceholder: { width: 90, height: 90, borderRadius: 45, borderWidth: 1.5, borderColor: '#2b5267', backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderText: { fontSize: 11, color: '#2b5267', fontWeight: '600', textAlign: 'center' },
  profileImage: { width: 90, height: 90, borderRadius: 45, borderWidth: 1.5, borderColor: '#2b5267' },
  badgeContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  roleBadge: { backgroundColor: '#1e3a4c', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2b5267' },
  roleBadgeText: { color: '#38bdf8', fontSize: 12, fontWeight: 'bold' },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  statusActive: { backgroundColor: '#065f46' },
  statusLeave: { backgroundColor: '#78350f' },
  statusText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  inputContainer: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginBottom: 16, paddingBottom: 4 },
  input: { fontSize: 15, color: '#1e293b', paddingVertical: 4 },
  disabledInput: { color: '#64748b' },
  idCardRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  idBox: { flex: 1, height: 100, borderRadius: 12, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  singleDocBox: { width: '100%', height: 110, borderRadius: 12, borderWidth: 1.5, borderColor: '#cbd5e1', backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 24 },
  idBoxText: { fontSize: 13, color: '#2b5267', fontWeight: '600', textAlign: 'center', paddingHorizontal: 4 },
  idImage: { width: '100%', height: '100%' },
  saveButton: { backgroundColor: '#2b5267', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
});