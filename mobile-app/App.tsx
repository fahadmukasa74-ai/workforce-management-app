import React, { useState, useEffect, createContext, useContext } from 'react';
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
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import EmployeeHomeScreen from './screen/EmployeeHomeScreen';
import ManagementDashboard from './screen/ManagementDashboard';
import EmployeeOverviewScreen from './screen/EmployeeOverviewScreen';
import SettingsScreen from './screen/SettingsScreen';
import ManagementSettingsScreen from './screen/ManagementSettingsScreen';
import ProfileScreen from './screen/ProfileScreen';
import PayslipsScreen from './screen/PayslipsScreen';
import LeaveScreen from './screen/LeaveScreen';
import ShiftsScreen from './screen/ShiftsScreen';
import AttendanceScreen from './screen/AttendanceScreen';
import AttendanceLogsScreen from './screen/AttendanceLogsScreen';
import ShiftManagementScreen from './screen/ShiftManagementScreen';
import LeaveManagementScreen from './screen/LeaveManagementScreen';
import PayslipManagementScreen from './screen/PayslipManagementScreen';
import ReportsAnalyticsScreen from './screen/ReportsAnalyticsScreen';
import MessageInboxScreen from './screen/MessageInboxScreen';
import ExpenseClaimScreen from './screen/ExpenseClaimScreen';
import ExpenseClaimsManagementScreen from './screen/ExpenseClaimsManagementScreen';
import EmployeeAnnouncementsScreen from './screen/EmployeeAnnouncementsScreen';
import AnnouncementsManagementScreen from './screen/AnnouncementsManagementScreen'; // Imported Admin Announcements Management Screen // Imported Admin Announcements Management Screen
import enTranslations from './lang/en.json';
import arTranslations from './lang/ar.json';

const translationsMap = {
  en: enTranslations,
  ar: arTranslations,
};

// --- FontSizeContext Setup ---
interface FontSizeContextType {
  fontSizeSetting: 'Small' | 'Medium' | 'Large';
  scale: number;
  globalTextStyle: { fontSize: number; lineHeight: number };
  setFontSizeSetting: (size: 'Small' | 'Medium' | 'Large') => Promise<void>;
}

const FontSizeContext = createContext<FontSizeContextType>({
  fontSizeSetting: 'Medium',
  scale: 16,
  globalTextStyle: { fontSize: 16, lineHeight: 20 },
  setFontSizeSetting: async () => {},
});

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSizeSetting, setFontSizeSettingState] = useState<'Small' | 'Medium' | 'Large'>('Medium');
  const [scale, setScale] = useState<number>(16);

  useEffect(() => {
    loadFontSize();
  }, []);

  const loadFontSize = async () => {
    try {
      const saved = await AsyncStorage.getItem('@portal_font_size');
      if (saved === 'Small' || saved === 'Medium' || saved === 'Large') {
        setFontSizeSettingState(saved);
        setScale(saved === 'Small' ? 12 : saved === 'Medium' ? 16 : 20);
      }
    } catch (error) {
      console.log('Failed to load font size preference', error);
    }
  };

  const setFontSizeSetting = async (size: 'Small' | 'Medium' | 'Large') => {
    try {
      await AsyncStorage.setItem('@portal_font_size', size);
      setFontSizeSettingState(size);
      setScale(size === 'Small' ? 12 : size === 'Medium' ? 16 : 20);
    } catch (error) {
      console.log('Failed to save font size preference', error);
    }
  };

  const globalTextStyle = {
    fontSize: scale,
    lineHeight: scale + 4,
  };

  return (
    <FontSizeContext.Provider value={{ fontSizeSetting, scale, globalTextStyle, setFontSizeSetting }}>
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = () => useContext(FontSizeContext);
// -----------------------------

const compressBase64Image = (base64Str: string, maxWidth = 100, maxHeight = 100): Promise<string> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }
    try {
      const img = new (window as any).Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.2));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    } catch (e) {
      resolve(base64Str);
    }
  });
};

const safeStorageSave = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error: any) {
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('exceeded the quota')) {
      console.warn('Storage quota exceeded. Clearing old profile caches...');
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const keysToRemove = allKeys.filter(
          (k) => k.startsWith('@profile_image_') && k !== key && k !== '@profile_image_fahadmukasa74@gmail.com'
        );
        if (keysToRemove.length > 0) {
          await AsyncStorage.multiRemove(keysToRemove);
          await AsyncStorage.setItem(key, value);
        }
      } catch (cleanError) {
        console.error('Failed to clear storage:', cleanError);
      }
    } else {
      throw error;
    }
  }
};

interface RegisteredWorker {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone: string;
  location: string;
  coordinates: string;
  profileImage?: string | null;
}

export default function App() {
  return (
    <FontSizeProvider>
      <MainAppContent />
    </FontSizeProvider>
  );
}

function MainAppContent() {
  const { globalTextStyle, setFontSizeSetting } = useFontSize();
  const [currentScreen, setCurrentScreen] = useState<
    | 'auth'
    | 'employeeHome'
    | 'management Dashboard'
    | 'employeeOverview'
    | 'settings'
    | 'managementSettings'
    | 'profile'
    | 'payslips'
    | 'leave'
    | 'shifts'
    | 'attendance'
    | 'attendanceLogs'
    | 'shiftManagement'
    | 'leaveManagement'
    | 'payslipManagement'
    | 'reportsAnalytics'
    | 'employeeMessages'
    | 'expenseClaims'
    | 'expenseClaimsManagement'
    | 'employeeAnnouncements'
    | 'announcementsManagement' // Added Screen State for Announcements Management History
  >('auth');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('FAHAD MUKASA');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [country, setCountry] = useState('UGANDA');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [role, setRole] = useState('Employee');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [currentLang, setCurrentLang] = useState<'en' | 'ar'>('en');

  const t = translationsMap[currentLang];

  useEffect(() => {
    loadAppData();
  }, []);

  const syncEmployeeSession = async (userEmail: string) => {
    try {
      const cleanEmail = userEmail.trim().toLowerCase();
      if (cleanEmail === 'fahadmukasa74@gmail.com') {
        setActiveEmployeeId('#1945');
        await safeStorageSave('@user_unique_id_fahadmukasa74@gmail.com', '#1945');
        return;
      }
      
      const savedEmailSpecificId = await AsyncStorage.getItem(`@user_unique_id_${cleanEmail}`);
      if (savedEmailSpecificId) {
        setActiveEmployeeId(savedEmailSpecificId);
        return;
      }

      const savedWorkersJson = await AsyncStorage.getItem('@registered_workers_list');
      if (savedWorkersJson) {
        const workers = JSON.parse(savedWorkersJson);
        const matchedWorker = workers.find(
          (w: any) => w.email && w.email.trim().toLowerCase() === cleanEmail
        );
        if (matchedWorker && matchedWorker.id) {
          await safeStorageSave(`@user_unique_id_${cleanEmail}`, matchedWorker.id);
          setActiveEmployeeId(matchedWorker.id);
        }
      }
    } catch (error) {
      console.log('Failed to sync persistent employee ID', error);
    }
  };

  const loadAppData = async (targetEmail?: string) => {
    try {
      const savedLang = await AsyncStorage.getItem('@app_language');
      if (savedLang === 'en' || savedLang === 'ar') {
        setCurrentLang(savedLang);
      }
      const activeEmail = targetEmail || (await AsyncStorage.getItem('@active_session_email'));
      if (activeEmail) {
        const userKey = activeEmail.trim().toLowerCase();
        await syncEmployeeSession(userKey);
        const savedRole = await AsyncStorage.getItem(`@role_${userKey}`);
        
        const savedId = await AsyncStorage.getItem(`@user_unique_id_${userKey}`);
        const currentId = userKey === 'fahadmukasa74@gmail.com' ? '#1945' : (savedId || '#1945');
        setActiveEmployeeId(currentId);

        const isAdminUser = savedRole === 'Admin' || userKey === 'fahadmukasa74@gmail.com';
        let savedImage = null;
        if (isAdminUser) {
          savedImage = await AsyncStorage.getItem('@profile_image_fahadmukasa74@gmail.com');
        } else if (currentId) {
          const cleanEmail = userKey;
          const cleanId = currentId.replace('#', '');
          savedImage = await AsyncStorage.getItem(`@profile_image_${cleanEmail}_${cleanId}`);
        }
        const savedName = await AsyncStorage.getItem(`@full_name_${userKey}`);

        if (savedImage && !savedImage.startsWith('blob:')) {
          setProfileImage(savedImage);
        } else {
          setProfileImage(null);
        }
        if (savedName) setFullName(savedName);
        if (savedRole) setRole(savedRole);
      }
    } catch (error) {
      console.log('Failed to load app data', error);
    }
  };

  const handleToggleLang = async (lang: 'en' | 'ar') => {
    setCurrentLang(lang);
    try {
      await safeStorageSave('@app_language', lang);
    } catch (error) {
      console.log('Failed to save language', error);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access camera roll is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.1,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      let rawImage = asset.uri;
      if (asset.base64) {
        rawImage = `data:image/jpeg;base64,${asset.base64}`;
      }
      const compressed = await compressBase64Image(rawImage);
      setProfileImage(compressed);

      const activeEmail = email || (await AsyncStorage.getItem('@active_session_email'));
      if (activeEmail && activeEmployeeId) {
        const cleanEmail = activeEmail.trim().toLowerCase();
        const cleanId = activeEmployeeId.replace('#', '');
        const isUserAdmin = role === 'Admin' || cleanEmail === 'fahadmukasa74@gmail.com';
        try {
          if (isUserAdmin) {
            await safeStorageSave('@profile_image_fahadmukasa74@gmail.com', compressed);
          } else {
            await safeStorageSave(`@profile_image_${cleanEmail}_${cleanId}`, compressed);
          }
          const savedWorkersJson = await AsyncStorage.getItem('@registered_workers_list');
          if (savedWorkersJson) {
            const workers = JSON.parse(savedWorkersJson);
            const updatedWorkers = workers.map((w: any) => {
              const matchesEmail = w.email && w.email.trim().toLowerCase() === cleanEmail;
              const matchesId = w.id === activeEmployeeId;
              if (matchesEmail || matchesId) {
                return { ...w, profileImage: null };
              }
              return w;
            });
            await safeStorageSave('@registered_workers_list', JSON.stringify(updatedWorkers));
          }
        } catch (storageError) {
          console.log('Image storage error caught:', storageError);
        }
      }
    }
  };

  const generateEmployeeID = (existingWorkers: RegisteredWorker[]): string => {
    const min = 1945;
    const max = 9236;
    let assignedId = '';
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 1000) {
      const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
      const candidateId = `#${randomNum}`;
      exists = existingWorkers.some((w) => w.id === candidateId || candidateId === '#1945');
      if (!exists) {
        assignedId = candidateId;
      }
      attempts++;
    }
    if (!assignedId) {
      assignedId = `#${Math.floor(1945 + Math.random() * 7291)}`;
    }
    return assignedId;
  };

  const handleRegister = async () => {
    try {
      if (!email.trim() || !password.trim()) {
        Alert.alert('Validation Error', 'Please enter a valid email and password.');
        return;
      }
      const cleanEmailInput = email.trim().toLowerCase();
      if (role === 'Admin') {
        if (cleanEmailInput !== 'fahadmukasa74@gmail.com' || password !== 'Fahad@1234#') {
          Alert.alert('Admin Access Denied', 'Admin role requires specific authorized credentials.');
          return;
        }
      }

      const existingWorkersJson = await AsyncStorage.getItem('@registered_workers_list');
      let workersList: RegisteredWorker[] = existingWorkersJson ? JSON.parse(existingWorkersJson) : [];
      const existingIndex = workersList.findIndex((w) => w.email.toLowerCase() === cleanEmailInput);
      let assignedId = '';

      if (role === 'Admin' || cleanEmailInput === 'fahadmukasa74@gmail.com') {
        assignedId = '#1945';
      } else if (existingIndex >= 0 && workersList[existingIndex].id) {
        assignedId = workersList[existingIndex].id;
      } else {
        assignedId = generateEmployeeID(workersList);
      }

      setActiveEmployeeId(assignedId);
      const isUserAdmin = role === 'Admin' || cleanEmailInput === 'fahadmukasa74@gmail.com';

      if (profileImage) {
        const cleanId = assignedId.replace('#', '');
        try {
          if (isUserAdmin) {
            await safeStorageSave('@profile_image_fahadmukasa74@gmail.com', profileImage);
          } else {
            await safeStorageSave(`@profile_image_${cleanEmailInput}_${cleanId}`, profileImage);
          }
        } catch (imgError) {
          console.log('Profile image storage skipped:', imgError);
        }
      }

      const newRegisteredWorker: RegisteredWorker = {
        id: assignedId,
        fullName: fullName.toUpperCase(),
        email: cleanEmailInput,
        role: isUserAdmin ? 'Admin' : role,
        phone: phone.trim() || '+971 50 000 0000',
        location: 'Al Bateen Hub',
        coordinates: '24.456338, 54.354812',
        profileImage: null,
      };

      // --- SAVE TO SUPABASE CLOUD DATABASE ---
      const { error: dbError } = await supabase.from('workers').upsert([
        {
          id: assignedId,
          full_name: fullName.toUpperCase(),
          email: cleanEmailInput,
          role: isUserAdmin ? 'Admin' : role,
          status: 'Active',
          department: 'Restaurant Operations',
        },
      ]);

      if (dbError) {
        console.log('Supabase sync error:', dbError.message);
      }

      if (existingIndex >= 0) {
        workersList[existingIndex] = { ...workersList[existingIndex], ...newRegisteredWorker };
      } else {
        workersList.push(newRegisteredWorker);
      }

      await safeStorageSave('@registered_workers_list', JSON.stringify(workersList));
      await safeStorageSave('@active_session_email', cleanEmailInput);
      await safeStorageSave(`@email_${cleanEmailInput}`, cleanEmailInput);
      await safeStorageSave(`@password_${cleanEmailInput}`, password);
      await safeStorageSave(`@full_name_${cleanEmailInput}`, fullName.toUpperCase());
      await safeStorageSave(`@role_${cleanEmailInput}`, isUserAdmin ? 'Admin' : role);
      await safeStorageSave(`@phone_${cleanEmailInput}`, phone);
      await safeStorageSave(`@user_unique_id_${cleanEmailInput}`, assignedId);

      Alert.alert('Success', `Account registered & synced to cloud! ID: ${assignedId}`);

      if (isUserAdmin) {
        setCurrentScreen('management Dashboard');
      } else {
        setCurrentScreen('employeeHome');
      }
    } catch (error) {
      console.log('Registration error:', error);
      Alert.alert('Error', 'Failed to save data.');
    }
  };

  const handleLogin = async () => {
    try {
      if (!loginEmail.trim() || !loginPassword.trim()) {
        Alert.alert('Validation Error', 'Please enter both email and password.');
        return;
      }

      const inputEmailKey = loginEmail.trim().toLowerCase();
      
      if (inputEmailKey === 'fahadmukasa74@gmail.com' && loginPassword === 'Fahad@1234#') {
        setFullName('FAHAD MUKASA');
        setRole('Admin');
        setActiveEmployeeId('#1945');
        await safeStorageSave('@active_session_email', loginEmail.trim());
        await safeStorageSave(`@role_${inputEmailKey}`, 'Admin');
        await safeStorageSave(`@email_${inputEmailKey}`, loginEmail.trim());
        await safeStorageSave(`@full_name_${inputEmailKey}`, 'FAHAD MUKASA');
        await safeStorageSave(`@user_unique_id_${inputEmailKey}`, '#1945');
        await loadAppData(loginEmail.trim());
        setCurrentScreen('management Dashboard');
        return;
      }

      const savedPassword = await AsyncStorage.getItem(`@password_${inputEmailKey}`);
      const savedRole = (await AsyncStorage.getItem(`@role_${inputEmailKey}`)) || 'Employee';
      const savedName = await AsyncStorage.getItem(`@full_name_${inputEmailKey}`);
      const savedId = await AsyncStorage.getItem(`@user_unique_id_${inputEmailKey}`);

      if (!savedPassword) {
        Alert.alert('Login Failed', 'No account found with this email. Please register first.');
        return;
      }

      if (loginPassword === savedPassword) {
        await safeStorageSave('@active_session_email', loginEmail.trim());
        await syncEmployeeSession(inputEmailKey);
        if (savedName) setFullName(savedName);
        if (savedRole) setRole(savedRole);
        if (savedId) setActiveEmployeeId(savedId);
        await loadAppData(loginEmail.trim());

        if (savedRole === 'Admin') {
          setCurrentScreen('management Dashboard');
        } else {
          setCurrentScreen('employeeHome');
        }
      } else {
        Alert.alert('Login Failed', 'Incorrect password.');
      }
    } catch (error) {
      console.log('Login error:', error);
      Alert.alert('Error', 'Failed to log in.');
    }
  };

  if (currentScreen === 'management Dashboard') {
    return (
      <ManagementDashboard
        onLogout={() => setCurrentScreen('auth')}
        onOpenEmployeeOverview={() => setCurrentScreen('employeeOverview')}
        onOpenAttendanceLogs={() => setCurrentScreen('attendanceLogs')}
        onOpenAttendance={() => setCurrentScreen('attendance')}
        onOpenShifts={() => setCurrentScreen('shifts')}
        onOpenShiftManagement={() => setCurrentScreen('shiftManagement')}
        onOpenLeave={() => setCurrentScreen('leave')}
        onOpenLeaveManagement={() => setCurrentScreen('leaveManagement')}
        onOpenPayslips={() => setCurrentScreen('payslips')}
        onOpenPayslipManagement={() => setCurrentScreen('payslipManagement')}
        onOpenExpenseClaims={() => setCurrentScreen('expenseClaimsManagement')}
        onOpenReportsAnalytics={() => setCurrentScreen('reportsAnalytics')}
        onOpenAnnouncementsManagement={() => setCurrentScreen('announcementsManagement')}
        onOpenProfile={() => {
          setSelectedEmployeeId('#1945');
          setCurrentScreen('profile');
        }}
        onOpenSettings={() => setCurrentScreen('managementSettings')}
        userName={fullName}
        userRole={role}
      />
    );
  }

  if (currentScreen === 'announcementsManagement') {
    return (
      <AnnouncementsManagementScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'expenseClaimsManagement') {
    return (
      <ExpenseClaimsManagementScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'employeeOverview') {
    return (
      <EmployeeOverviewScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        onViewProfile={(employeeId) => {
          setSelectedEmployeeId(employeeId);
          setCurrentScreen('profile');
        }}
      />
    );
  }

  if (currentScreen === 'attendanceLogs') {
    return (
      <AttendanceLogsScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        onViewEmployeeProfile={(employeeId) => {
          setSelectedEmployeeId(employeeId);
          setCurrentScreen('profile');
        }}
      />
    );
  }

  if (currentScreen === 'shiftManagement') {
    return (
      <ShiftManagementScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        onOpenAttendanceLogs={() => setCurrentScreen('attendanceLogs')}
        onOpenEmployeeOverview={() => setCurrentScreen('employeeOverview')}
      />
    );
  }

  if (currentScreen === 'leaveManagement') {
    return (
      <LeaveManagementScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        onOpenAttendanceLogs={() => setCurrentScreen('attendanceLogs')}
        onOpenEmployeeOverview={() => setCurrentScreen('employeeOverview')}
      />
    );
  }

  if (currentScreen === 'payslipManagement') {
    return (
      <PayslipManagementScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        onOpenAttendanceLogs={() => setCurrentScreen('attendanceLogs')}
        onOpenLeaveManagement={() => setCurrentScreen('leaveManagement')}
      />
    );
  }

  if (currentScreen === 'reportsAnalytics') {
    return (
      <ReportsAnalyticsScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        onOpenAttendanceLogs={() => setCurrentScreen('attendanceLogs')}
        onOpenPayslipManagement={() => setCurrentScreen('payslipManagement')}
        onOpenLeaveManagement={() => setCurrentScreen('leaveManagement')}
      />
    );
  }

  if (currentScreen === 'managementSettings') {
    return (
      <ManagementSettingsScreen
        onBack={() => setCurrentScreen('management Dashboard')}
        currentLang={currentLang}
        onToggleLang={handleToggleLang}
        onFontSizeChange={(size) => setFontSizeSetting(size)}
        globalTextStyle={globalTextStyle}
      />
    );
  }

  if (currentScreen === 'attendance') {
    return (
      <AttendanceScreen
        onBack={() => {
          if (role === 'Admin') {
            setCurrentScreen('management Dashboard');
          } else {
            setCurrentScreen('employeeHome');
          }
        }}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'shifts') {
    return (
      <ShiftsScreen
        onBack={() => {
          if (role === 'Admin') {
            setCurrentScreen('management Dashboard');
          } else {
            setCurrentScreen('employeeHome');
          }
        }}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'leave') {
    return (
      <LeaveScreen
        onBack={() => {
          if (role === 'Admin') {
            setCurrentScreen('management Dashboard');
          } else {
            setCurrentScreen('employeeHome');
          }
        }}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'payslips') {
    return (
      <PayslipsScreen
        onBack={() => {
          if (role === 'Admin') {
            setCurrentScreen('management Dashboard');
          } else {
            setCurrentScreen('employeeHome');
          }
        }}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'profile') {
    return (
      <ProfileScreen
        employeeId={selectedEmployeeId}
        onBack={() => {
          loadAppData();
          setSelectedEmployeeId(null);
          if (role === 'Admin') {
            setCurrentScreen('management Dashboard');
          } else {
            setCurrentScreen('employeeHome');
          }
        }}
        onProfileUpdated={() => loadAppData()}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'settings') {
    return (
      <SettingsScreen
        onBack={() => {
          if (role === 'Admin') {
            setCurrentScreen('management Dashboard');
          } else {
            setCurrentScreen('employeeHome');
          }
        }}
        currentLang={currentLang}
        onToggleLang={handleToggleLang}
      />
    );
  }

  if (currentScreen === 'employeeMessages') {
    return (
      <MessageInboxScreen
        onBack={() => setCurrentScreen('employeeHome')}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'expenseClaims') {
    return (
      <ExpenseClaimScreen
        onBack={() => setCurrentScreen('employeeHome')}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'employeeAnnouncements') {
    return (
      <EmployeeAnnouncementsScreen
        onBack={() => setCurrentScreen('employeeHome')}
        currentLang={currentLang}
      />
    );
  }

  if (currentScreen === 'employeeHome') {
    return (
      <EmployeeHomeScreen
        onLogout={() => setCurrentScreen('auth')}
        onOpenSettings={() => setCurrentScreen('settings')}
        onOpenProfile={() => {
          setSelectedEmployeeId(null);
          setCurrentScreen('profile');
        }}
        onOpenPayslips={() => setCurrentScreen('payslips')}
        onOpenLeave={() => setCurrentScreen('leave')}
        onOpenShifts={() => setCurrentScreen('shifts')}
        onOpenAttendance={() => setCurrentScreen('attendance')}
        onOpenMessages={() => setCurrentScreen('employeeMessages')}
        onOpenExpenseClaims={() => setCurrentScreen('expenseClaims')}
        onOpenAnnouncements={() => setCurrentScreen('employeeAnnouncements')}
        userName={fullName}
        profileImage={profileImage}
        currentLang={currentLang}
        employeeId={activeEmployeeId ? activeEmployeeId.replace('#', '') : undefined}
        userEmail={email}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { direction: currentLang === 'ar' ? 'rtl' : 'ltr' }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {isLoginView ? (
            <>
              <Text style={[styles.title, globalTextStyle]}>LOGIN</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="Enter Registered Email"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="Enter Password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={true}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                />
              </View>
              <TouchableOpacity style={styles.registerButton} onPress={handleLogin}>
                <Text style={[styles.registerButtonText, globalTextStyle]}>LOGIN</Text>
              </TouchableOpacity>
              <View style={styles.switchRow}>
                <Text style={[styles.switchText, globalTextStyle]}>Don't have an account?</Text>
                <TouchableOpacity onPress={() => setIsLoginView(false)}>
                  <Text style={[styles.switchActionText, globalTextStyle]}>REGISTER</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.title, globalTextStyle]}>REGISTER</Text>
              <TouchableOpacity style={styles.imagePickerContainer} onPress={pickImage}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={[styles.imagePlaceholderText, globalTextStyle]}>+ Profile Pic</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="Email Address"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="Password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={true}
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="Full Name"
                  placeholderTextColor="#9ca3af"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                  value={dob}
                  onChangeText={setDob}
                />
              </View>
              <Text style={[styles.label, globalTextStyle]}>Gender</Text>
              <View style={styles.pillsRow}>
                {['Male', 'Female', 'Other'].map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.pill, gender === item && styles.pillActive]}
                    onPress={() => setGender(item)}
                  >
                    <Text style={[styles.pillText, globalTextStyle, gender === item && styles.pillTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="Country"
                  placeholderTextColor="#9ca3af"
                  value={country}
                  onChangeText={setCountry}
                />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="Phone Number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, globalTextStyle]}
                  placeholder="City"
                  placeholderTextColor="#9ca3af"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <Text style={[styles.label, globalTextStyle]}>Select Role:</Text>
              <View style={styles.pillsRow}>
                {['Employee', 'Manager', 'Supervisor', 'Admin'].map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.pill, role === item && styles.pillActive]}
                    onPress={() => setRole(item)}
                  >
                    <Text style={[styles.pillText, globalTextStyle, role === item && styles.pillTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
                <Text style={[styles.registerButtonText, globalTextStyle]}>REGISTER</Text>
              </TouchableOpacity>
              <View style={styles.switchRow}>
                <Text style={[styles.switchText, globalTextStyle]}>Already have an Account?</Text>
                <TouchableOpacity onPress={() => setIsLoginView(true)}>
                  <Text style={[styles.switchActionText, globalTextStyle]}>LOGIN</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2b5267' },
  container: { flexGrow: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: '100%',
    maxWidth: 550,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    marginVertical: 20,
  },
  title: { fontWeight: 'bold', textAlign: 'center', color: '#0f172a', marginBottom: 24, letterSpacing: 1 },
  imagePickerContainer: { alignSelf: 'center', marginBottom: 24 },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: '#2b5267',
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: { color: '#2b5267', fontWeight: '600', textAlign: 'center' },
  profileImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, borderColor: '#2b5267' },
  inputContainer: { borderBottomWidth: 1, borderBottomColor: '#cbd5e1', marginBottom: 20, paddingBottom: 4 },
  input: { color: '#1e293b', paddingVertical: 6 },
  label: { fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  pill: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#e2e8f0' },
  pillActive: { backgroundColor: '#2b5267' },
  pillText: { color: '#475569', fontWeight: '500' },
  pillTextActive: { color: '#ffffff' },
  registerButton: {
    backgroundColor: '#2b5267',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  registerButtonText: { color: '#ffffff', fontWeight: 'bold', letterSpacing: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  switchText: { color: '#64748b' },
  switchActionText: { fontWeight: 'bold', color: '#2b5267' },
});