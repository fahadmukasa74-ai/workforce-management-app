import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

interface Message {
  id?: string;
  sender: string;
  recipient: string;
  recipientId?: string;
  timestamp: string;
  subject?: string;
  body: string;
  status: 'Unread' | 'Read';
}

interface MessageInboxScreenProps {
  onBack: () => void;
  currentLang?: 'en' | 'ar';
}

export default function MessageInboxScreen({ onBack, currentLang = 'en' }: MessageInboxScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userKeyData, setUserKeyData] = useState<{ email: string; id: string } | null>(null);

  useEffect(() => {
    loadAndMarkMessagesRead();
    const interval = setInterval(loadAndMarkMessagesRead, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadAndMarkMessagesRead = async () => {
    try {
      const activeEmail = await AsyncStorage.getItem('@active_session_email');
      const userKey = (activeEmail || '').trim().toLowerCase();
      const savedId = await AsyncStorage.getItem(`@user_unique_id_${userKey}`);
      const cleanId = (savedId || '').replace('#', '');

      setUserKeyData({ email: userKey, id: cleanId });

      let foundMessages: Message[] = [];

      // --- FETCH MESSAGES FROM SUPABASE CLOUD DATABASE ---
      const { data: cloudMsgs, error: cloudError } = await supabase.from('messages').select('*');

      if (!cloudError && cloudMsgs && cloudMsgs.length > 0) {
        const mappedCloudMsgs: Message[] = cloudMsgs.map((m: any) => ({
          id: m.id || `msg-${Date.now()}`,
          sender: m.sender || 'Admin',
          recipient: m.recipient || '',
          recipientId: m.recipient_id || m.recipientId || '',
          timestamp: m.timestamp || new Date().toISOString(),
          subject: m.subject || 'Secure Corporate Notification',
          body: m.body || '',
          status: m.status || 'Unread',
        }));

        const isAdminView = userKey === 'fahadmukasa74@gmail.com';
        const filteredCloud = mappedCloudMsgs.filter((m) => {
          const matchEmail = m.recipient?.trim().toLowerCase() === userKey;
          const matchId = m.recipientId?.replace('#', '') === cleanId;
          return matchEmail || matchId || isAdminView;
        });

        foundMessages = [...foundMessages, ...filteredCloud];
      }

      // Fallback / addition from local storage
      if (userKey && cleanId) {
        const msgKey = `@employee_message_${userKey}_${cleanId}`;
        const savedMsgsJson = await AsyncStorage.getItem(msgKey);
        if (savedMsgsJson) {
          foundMessages = [...foundMessages, ...JSON.parse(savedMsgsJson)];
        }
      }

      const globalJson = await AsyncStorage.getItem('@all_corporate_messages');
      if (globalJson) {
        const globalList: Message[] = JSON.parse(globalJson);
        const matchedGlobal = globalList.filter((m) => {
          const matchEmail = m.recipient?.trim().toLowerCase() === userKey;
          const matchId = m.recipientId?.replace('#', '') === cleanId;
          const isAdminView = userKey === 'fahadmukasa74@gmail.com';
          return matchEmail || matchId || isAdminView;
        });
        foundMessages = [...foundMessages, ...matchedGlobal];
      }

      // Deduplicate by message ID or timestamp
      const uniqueMap = new Map();
      foundMessages.forEach((m) => {
        const uniqueKey = m.id || `${m.timestamp}-${m.body?.substring(0, 10)}`;
        uniqueMap.set(uniqueKey, m);
      });

      const list: Message[] = Array.from(uniqueMap.values());

      // Automatically mark all as Read when opened
      let hasUnread = false;
      const updatedList = list.map((m) => {
        if (m.status === 'Unread') {
          hasUnread = true;
          return { ...m, status: 'Read' as const };
        }
        return m;
      });

      setMessages(updatedList.reverse());

      if (hasUnread) {
        // Sync read status to Supabase cloud
        for (const msg of updatedList) {
          if (msg.status === 'Read' && msg.id) {
            await supabase
              .from('messages')
              .update({ status: 'Read' })
              .eq('id', msg.id);
          }
        }

        if (userKey && cleanId) {
          const msgKey = `@employee_message_${userKey}_${cleanId}`;
          await AsyncStorage.setItem(msgKey, JSON.stringify(updatedList));
        }

        if (globalJson) {
          const globalList: Message[] = JSON.parse(globalJson);
          const updatedGlobal = globalList.map((m) => {
            const matchEmail = m.recipient?.trim().toLowerCase() === userKey;
            const matchId = m.recipientId?.replace('#', '') === cleanId;
            if ((matchEmail || matchId) && m.status === 'Unread') {
              return { ...m, status: 'Read' as const };
            }
            return m;
          });
          await AsyncStorage.setItem('@all_corporate_messages', JSON.stringify(updatedGlobal));
        }
      }
    } catch (error) {
      console.log('Failed to load and mark messages as read from cloud/storage', error);
    }
  };

  const handleDeleteMessage = async (index: number) => {
    if (!userKeyData) return;
    Alert.alert(
      currentLang === 'ar' ? 'حذف الرسالة' : 'Delete Message',
      currentLang === 'ar' ? 'هل أنت متأكد من حذف هذه الرسالة؟' : 'Are you sure you want to delete this message?',
      [
        { text: currentLang === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: currentLang === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            const targetMsg = messages[index];
            const updated = messages.filter((_, i) => i !== index);
            setMessages(updated);

            // --- DELETE FROM SUPABASE CLOUD ---
            if (targetMsg.id) {
              await supabase.from('messages').delete().eq('id', targetMsg.id);
            }

            if (userKeyData.email && userKeyData.id) {
              const msgKey = `@employee_message_${userKeyData.email}_${userKeyData.id}`;
              await AsyncStorage.setItem(msgKey, JSON.stringify(updated));
            }

            const globalJson = await AsyncStorage.getItem('@all_corporate_messages');
            if (globalJson) {
              const globalList: Message[] = JSON.parse(globalJson);
              const filteredGlobal = globalList.filter((m) => m.id !== targetMsg.id);
              await AsyncStorage.setItem('@all_corporate_messages', JSON.stringify(filteredGlobal));
            }
          },
        },
      ]
    );
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
            {currentLang === 'ar' ? 'صندوق الوارد للإشعارات' : 'Notifications & Messages'}
          </Text>
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {currentLang === 'ar' ? 'لا توجد رسائل إدارية جديدة.' : 'No messages or notifications in your inbox.'}
            </Text>
          </View>
        ) : (
          messages.map((msg, index) => (
            <View
              key={msg.id || index}
              style={[styles.msgCard, msg.status === 'Unread' && styles.unreadMsgCard]}
            >
              <View style={styles.msgHeaderRow}>
                <View style={styles.senderBadge}>
                  <Text style={styles.senderBadgeText}>{msg.sender || 'Admin'}</Text>
                </View>
                <View style={[styles.statusPill, msg.status === 'Unread' ? styles.pillUnread : styles.pillRead]}>
                  <Text style={styles.statusPillText}>{msg.status}</Text>
                </View>
              </View>

              <Text style={styles.msgSubject}>{msg.subject || 'Secure Corporate Notification'}</Text>
              <Text style={styles.msgBody}>{msg.body}</Text>

              <View style={styles.msgFooterRow}>
                <Text style={styles.msgTimestamp}>
                  {new Date(msg.timestamp).toLocaleString()}
                </Text>
                <TouchableOpacity onPress={() => handleDeleteMessage(index)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
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
  container: { flexGrow: 1, padding: 16, width: '100%', maxWidth: 600, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 16, marginTop: 10 },
  backButton: { backgroundColor: '#1e3a4c', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  backButtonText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#ffffff' },
  emptyCard: { backgroundColor: '#12202a', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#1e3a4c', marginTop: 20 },
  emptyText: { color: '#94a3b8', fontSize: 14, fontStyle: 'italic' },
  msgCard: { backgroundColor: '#12202a', borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#1e3a4c' },
  unreadMsgCard: { borderColor: '#f59e0b', backgroundColor: '#162833' },
  msgHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  senderBadge: { backgroundColor: '#1e3a4c', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  senderBadgeText: { color: '#38bdf8', fontSize: 11, fontWeight: 'bold' },
  statusPill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  pillUnread: { backgroundColor: '#78350f' },
  pillRead: { backgroundColor: '#065f46' },
  statusPillText: { color: '#ffffff', fontSize: 10, fontWeight: 'bold' },
  msgSubject: { fontSize: 16, fontWeight: 'bold', color: '#ffffff', marginBottom: 6 },
  msgBody: { fontSize: 14, color: '#cbd5e1', lineHeight: 20, marginBottom: 14 },
  msgFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1e3a4c', paddingTop: 10 },
  msgTimestamp: { fontSize: 11, color: '#94a3b8' },
  deleteText: { fontSize: 12, color: '#f87171', fontWeight: 'bold' },
});