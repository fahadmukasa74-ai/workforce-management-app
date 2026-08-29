import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import enTranslations from '../lang/en.json';
import arTranslations from '../lang/ar.json';

const translationsMap = {
  en: enTranslations,
  ar: arTranslations,
};

interface AnnouncementItem {
  id: string;
  title: string;
  message: string;
  sender: string;
  media_urls?: string[];
  media_url?: string | string[];
  media_type?: string;
  timestamp: string;
}

interface AnnouncementsManagementScreenProps {
  onBack: () => void;
  currentLang?: 'en' | 'ar';
}

export default function AnnouncementsManagementScreen({
  onBack,
  currentLang = 'en',
}: AnnouncementsManagementScreenProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  const t = translationsMap[currentLang] || translationsMap.en;
  const isRTL = currentLang === 'ar';

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    fetchAnnouncements();
    return () => {
      subscription?.remove();
    };
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      if (data) {
        setAnnouncements(data);
      }
    } catch (err: any) {
      console.log('Error fetching announcements:', err.message);
      // Fallback to local storage if network fails
      try {
        const local = await AsyncStorage.getItem('@admin_announcements_history');
        if (local) {
          setAnnouncements(JSON.parse(local));
        }
      } catch (e) {
        // Ignore
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    Alert.alert(
      isRTL ? 'حذف الإعلان' : 'Delete Announcement',
      isRTL ? 'هل أنت متأكد من حذف هذا الإعلان نهائياً؟' : 'Are you sure you want to delete this announcement?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('announcements').delete().eq('id', id);
              if (error) throw error;

              setAnnouncements((prev) => prev.filter((item) => item.id !== id));
              Alert.alert(isRTL ? 'تم الحذف' : 'Success', isRTL ? 'تم حذف الإعلان بنجاح.' : 'Announcement deleted successfully.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete announcement.');
            }
          },
        },
      ]
    );
  };

  const isDesktop = windowWidth > 900;

  return (
    <SafeAreaView style={[styles.safeArea, { direction: isRTL ? 'rtl' : 'ltr' } as any]}>
      <View style={[styles.headerContainer, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{isRTL ? '← لوحة التحكم' : '← Dashboard'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isRTL ? 'إدارة سجل الإعلانات' : 'Announcements History & Management'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <View style={[styles.cardTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View>
              <Text style={[styles.cardMainTitle, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'الإعلانات والرسائل الإذاعية المرسلة' : 'Broadcasted Global Announcements'}
              </Text>
              <Text style={[styles.cardSubTitle, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'مراجعة وتتبع وحذف الإعلانات السابقة المرسلة للعاملين' : 'Review, track, and manage all system-wide announcements'}
              </Text>
            </View>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchAnnouncements}>
              <Text style={styles.refreshBtnText}>{isRTL ? '🔄 تحديث' : '🔄 Refresh'}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.loaderText}>{isRTL ? 'جاري التحميل...' : 'Loading announcements...'}</Text>
            </View>
          ) : announcements.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={[styles.emptyText, isRTL && { textAlign: 'right' }]}>
                {isRTL ? 'لا توجد إعلانات سابقة مسجلة.' : 'No announcements found in the database.'}
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {announcements.map((item, index) => {
                let mediaArray: string[] = [];
                if (Array.isArray(item.media_urls) && item.media_urls.length > 0) {
                  mediaArray = item.media_urls;
                } else if (Array.isArray(item.media_url)) {
                  mediaArray = item.media_url;
                } else if (typeof item.media_url === 'string' && item.media_url.trim() !== '') {
                  mediaArray = [item.media_url];
                }

                return (
                  <View key={item.id || index} style={[styles.announcementCard, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={styles.announcementContent}>
                      <View style={[styles.announcementHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Text style={[styles.announcementTitleText, isRTL && { textAlign: 'right' }]}>{item.title}</Text>
                        <Text style={styles.announcementDateText}>
                          {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Just now'}
                        </Text>
                      </View>
                      <Text style={[styles.announcementSenderText, isRTL && { textAlign: 'right' }]}>
                        {isRTL ? 'بواسطة: ' : 'Sender: '}{item.sender || 'Admin'}
                      </Text>
                      <Text style={[styles.announcementMessageText, isRTL && { textAlign: 'right' }]}>{item.message}</Text>

                      {mediaArray.length > 0 && (
                        <View style={styles.mediaGrid}>
                          {mediaArray.map((url, mediaIndex) => (
                            <View key={mediaIndex} style={styles.mediaPreviewBox}>
                              {url.includes('.mp4') || url.includes('video') ? (
                                <View style={styles.videoPlaceholder}>
                                  <Text style={styles.videoText}>▶ VIDEO ATTACHED</Text>
                                </View>
                              ) : (
                                <Image source={{ uri: url }} style={styles.attachedImage} resizeMode="cover" />
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.deleteAnnounceBtn}
                      onPress={() => handleDeleteAnnouncement(item.id)}
                    >
                      <Text style={styles.deleteAnnounceBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2b5267' },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#12202a', borderBottomWidth: 1, borderBottomColor: '#1e3a4c' },
  backButton: { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#1e3a4c', borderRadius: 8, marginRight: 12 },
  backButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', flex: 1 },
  container: { flexGrow: 1, padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 800, backgroundColor: '#12202a', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, borderWidth: 1, borderColor: '#1e3a4c' },
  cardDesktop: { padding: 32 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12, borderBottomWidth: 1, borderBottomColor: '#1e3a4c', paddingBottom: 16 },
  cardMainTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  cardSubTitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  refreshBtn: { backgroundColor: '#2563eb', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  refreshBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  loaderContainer: { paddingVertical: 50, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: '#94a3b8', fontSize: 14 },
  emptyContainer: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 10 },
  emptyText: { color: '#94a3b8', fontSize: 15, fontWeight: '500' },
  listContainer: { gap: 16 },
  announcementCard: { backgroundColor: '#1a2c38', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2b5267', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  announcementContent: { flex: 1 },
  announcementHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 },
  announcementTitleText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', flex: 1 },
  announcementDateText: { fontSize: 11, color: '#38bdf8' },
  announcementSenderText: { fontSize: 12, color: '#fbbf24', marginBottom: 8, fontWeight: '600' },
  announcementMessageText: { fontSize: 14, color: '#cbd5e1', lineHeight: 20, marginBottom: 12 },
  mediaGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 8 },
  mediaPreviewBox: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155' },
  attachedImage: { width: '100%', height: '100%' },
  videoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 4 },
  videoText: { color: '#38bdf8', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  deleteAnnounceBtn: { backgroundColor: '#991b1b', width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  deleteAnnounceBtnText: { fontSize: 16 },
});