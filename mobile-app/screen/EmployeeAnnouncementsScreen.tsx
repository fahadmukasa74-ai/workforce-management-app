import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../supabaseClient';

interface Announcement {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  sender: string;
  media_urls?: string[];
  media_url?: string[];
  media_type?: string;
}

interface EmployeeAnnouncementsScreenProps {
  onBack: () => void;
  currentLang?: 'en' | 'ar';
}

export default function EmployeeAnnouncementsScreen({
  onBack,
  currentLang = 'en',
}: EmployeeAnnouncementsScreenProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Full-size image modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // Downloading state indicator per file URL
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchAnnouncements();

    // Real-time listener for instant announcement and media sync
    const channel = supabase
      .channel('employee-announcements-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          fetchAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
        console.error('Error fetching announcements:', error.message);
      } else {
        setAnnouncements(data || []);
      }
    } catch (err) {
      console.error('Network error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMedia = async (url: string) => {
    try {
      setDownloadingUrl(url);
      const filename = url.split('/').pop()?.split('?')[0] || `announcement_file_${Date.now()}.jpg`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(url, fileUri);
      if (downloadResult.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri);
        } else {
          Alert.alert('Success', `File downloaded successfully to: ${downloadResult.uri}`);
        }
      } else {
        throw new Error('Download failed with status: ' + downloadResult.status);
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download media file.');
    } finally {
      setDownloadingUrl(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { direction: currentLang === 'ar' ? 'rtl' : 'ltr' }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← {currentLang === 'ar' ? 'رجوع' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentLang === 'ar' ? 'الإعلانات والتهديف العام' : 'Global Announcements'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>
              {currentLang === 'ar' ? 'جاري تحميل الإعلانات...' : 'Loading announcements...'}
            </Text>
          </View>
        ) : announcements.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>
              {currentLang === 'ar' ? 'لا توجد إعلانات حالياً' : 'No Announcements Found'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {currentLang === 'ar'
                ? 'تحقق لاحقاً للاطلاع على التحديثات والإعلانات الصادرة من الإدارة.'
                : 'Check back later for updates and broadcasts from administration.'}
            </Text>
          </View>
        ) : (
          announcements.map((item) => {
            const mediaList = item.media_urls || item.media_url || [];
            return (
              <View key={item.id} style={styles.announcementCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.announcementTitle}>{item.title}</Text>
                  <Text style={styles.timestampText}>
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.announcementMessage}>{item.message}</Text>

                {/* Render Attached Media Files with View & Download Support */}
                {mediaList.length > 0 && (
                  <View style={styles.mediaContainer}>
                    {mediaList.map((url, index) => {
                      const isVideo = item.media_type === 'video' || url.includes('.mp4') || url.includes('video');
                      return (
                        <View key={index} style={styles.mediaWrapper}>
                          {isVideo ? (
                            <View style={styles.videoContainer}>
                              <Video
                                source={{ uri: url }}
                                style={styles.mediaVideo}
                                useNativeControls
                                resizeMode={ResizeMode.CONTAIN}
                                isLooping={false}
                              />
                            </View>
                          ) : (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                setSelectedImageUri(url);
                                setModalVisible(true);
                              }}
                              style={styles.imageTouchable}
                            >
                              <Image source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
                              <View style={styles.zoomOverlayTag}>
                                <Text style={styles.zoomOverlayText}>🔍 {currentLang === 'ar' ? 'تكبير' : 'Tap to Zoom'}</Text>
                              </View>
                            </TouchableOpacity>
                          )}

                          {/* Download Button */}
                          <TouchableOpacity
                            style={styles.downloadButton}
                            onPress={() => handleDownloadMedia(url)}
                            disabled={downloadingUrl === url}
                          >
                            {downloadingUrl === url ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text style={styles.downloadButtonText}>
                                📥 {currentLang === 'ar' ? 'تنزيل الملف' : 'Download File'}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View style={styles.cardFooterRow}>
                  <Text style={styles.senderText}>
                    {currentLang === 'ar' ? 'المُرسل: ' : 'Posted by: '}
                    <Text style={styles.senderName}>{item.sender || 'Admin'}</Text>
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Full-Size Image Modal Viewer */}
      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalCloseArea} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContentBox}>
            {selectedImageUri && (
              <Image source={{ uri: selectedImageUri }} style={styles.fullScreenImage} resizeMode="contain" />
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeModalBtnText}>✕ {currentLang === 'ar' ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2b5267' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a4c',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#12202a',
    borderRadius: 8,
    marginRight: 12,
  },
  backButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#ffffff', flex: 1 },
  container: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  centered: { marginTop: 60, alignItems: 'center' },
  loadingText: { color: '#cbd5e1', marginTop: 12, fontSize: 14 },
  emptyCard: {
    width: '100%',
    maxWidth: 550,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  announcementCard: {
    width: '100%',
    maxWidth: 550,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  announcementTitle: { fontSize: 16, fontWeight: 'bold', color: '#1d4ed8', flex: 1 },
  timestampText: { fontSize: 11, color: '#64748b', textAlign: 'right' },
  announcementMessage: { fontSize: 14, color: '#0f172a', lineHeight: 20, marginBottom: 14 },
  mediaContainer: { marginBottom: 14, gap: 12 },
  mediaWrapper: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#e2e8f0', borderWidth: 1, borderColor: '#cbd5e1' },
  imageTouchable: { width: '100%', height: 210, position: 'relative' },
  mediaImage: { width: '100%', height: '100%' },
  zoomOverlayTag: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  zoomOverlayText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  videoContainer: { width: '100%', height: 210, backgroundColor: '#000000' },
  mediaVideo: { width: '100%', height: '100%' },
  downloadButton: { backgroundColor: '#1e3a4c', paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  downloadButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  cardFooterRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  senderText: { fontSize: 12, color: '#64748b' },
  senderName: { color: '#0f172a', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center' },
  modalCloseArea: { position: 'absolute', width: '100%', height: '100%' },
  modalContentBox: { width: '90%', height: '80%', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '85%', borderRadius: 12 },
  closeModalBtn: { marginTop: 20, backgroundColor: '#dc2626', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  closeModalBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
});