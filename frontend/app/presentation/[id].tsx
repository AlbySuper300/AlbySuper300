import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Scripture {
  reference: string;
  text?: string;
  url?: string;
}

interface Objection {
  objection: string;
  response: string;
}

interface Presentation {
  id: string;
  title: string;
  intro: string;
  main_points: string[];
  questions: string[];
  scriptures: Scripture[];
  objections: Objection[];
  topic?: string;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export default function PresentationDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedObjections, setExpandedObjections] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchPresentation();
  }, [id]);

  const fetchPresentation = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/presentations/${id}`);
      setPresentation(response.data);
    } catch (error) {
      console.error('Error fetching presentation:', error);
      Alert.alert('Errore', 'Impossibile caricare la presentazione', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const openScripture = (scripture: Scripture) => {
    if (scripture.url) {
      router.push({
        pathname: '/scripture',
        params: { url: scripture.url, reference: scripture.reference },
      });
    } else {
      // Fallback to search
      const searchUrl = `https://wol.jw.org/it/wol/s/r6/lp-i?q=${encodeURIComponent(
        scripture.reference
      )}`;
      router.push({
        pathname: '/scripture',
        params: { url: searchUrl, reference: scripture.reference },
      });
    }
  };

  const toggleObjection = (index: number) => {
    const newExpanded = new Set(expandedObjections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedObjections(newExpanded);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6c5ce7" />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  if (!presentation) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Presentazione non trovata</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{presentation.title}</Text>
          {presentation.is_ai_generated && (
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={14} color="#ffd700" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}
        </View>
        {presentation.topic && (
          <View style={styles.topicBadge}>
            <Text style={styles.topicText}>{presentation.topic}</Text>
          </View>
        )}
      </View>

      {/* Intro */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="chatbubble-outline" size={20} color="#6c5ce7" />
          <Text style={styles.sectionTitle}>Come iniziare</Text>
        </View>
        <View style={styles.introCard}>
          <Text style={styles.introText}>"{presentation.intro}"</Text>
        </View>
      </View>

      {/* Main Points */}
      {presentation.main_points.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={20} color="#6c5ce7" />
            <Text style={styles.sectionTitle}>Punti principali</Text>
          </View>
          {presentation.main_points.map((point, index) => (
            <View key={index} style={styles.listItem}>
              <View style={styles.bullet}>
                <Text style={styles.bulletText}>{index + 1}</Text>
              </View>
              <Text style={styles.listText}>{point}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Questions */}
      {presentation.questions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle-outline" size={20} color="#6c5ce7" />
            <Text style={styles.sectionTitle}>Domande da porre</Text>
          </View>
          {presentation.questions.map((question, index) => (
            <View key={index} style={styles.questionCard}>
              <Ionicons name="help" size={16} color="#ffd700" />
              <Text style={styles.questionText}>{question}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Scriptures */}
      {presentation.scriptures.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={20} color="#6c5ce7" />
            <Text style={styles.sectionTitle}>Scritture bibliche</Text>
          </View>
          <Text style={styles.scriptureHint}>Tocca per leggere su wol.jw.org</Text>
          {presentation.scriptures.map((scripture, index) => (
            <TouchableOpacity
              key={index}
              style={styles.scriptureCard}
              onPress={() => openScripture(scripture)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text" size={20} color="#00cec9" />
              <Text style={styles.scriptureReference}>{scripture.reference}</Text>
              <Ionicons name="chevron-forward" size={20} color="#6a6a8a" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Objections */}
      {presentation.objections.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-outline" size={20} color="#6c5ce7" />
            <Text style={styles.sectionTitle}>Obiezioni comuni</Text>
          </View>
          {presentation.objections.map((obj, index) => (
            <TouchableOpacity
              key={index}
              style={styles.objectionCard}
              onPress={() => toggleObjection(index)}
              activeOpacity={0.8}
            >
              <View style={styles.objectionHeader}>
                <Ionicons
                  name={expandedObjections.has(index) ? 'chevron-down' : 'chevron-forward'}
                  size={20}
                  color="#ff6b6b"
                />
                <Text style={styles.objectionText}>{obj.objection}</Text>
              </View>
              {expandedObjections.has(index) && (
                <View style={styles.responseContainer}>
                  <Text style={styles.responseLabel}>Risposta suggerita:</Text>
                  <Text style={styles.responseText}>{obj.response}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Date */}
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>
          Ultimo aggiornamento: {new Date(presentation.updated_at).toLocaleDateString('it-IT')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8888aa',
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  aiBadgeText: {
    color: '#ffd700',
    fontSize: 12,
    fontWeight: '700',
  },
  topicBadge: {
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  topicText: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  introCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#6c5ce7',
  },
  introText: {
    fontSize: 16,
    color: '#ddd',
    fontStyle: 'italic',
    lineHeight: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6c5ce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulletText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listText: {
    flex: 1,
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    color: '#ddd',
    lineHeight: 22,
  },
  scriptureHint: {
    fontSize: 12,
    color: '#6a6a8a',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  scriptureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#00cec9',
  },
  scriptureReference: {
    flex: 1,
    fontSize: 16,
    color: '#00cec9',
    fontWeight: '600',
  },
  objectionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  objectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  objectionText: {
    flex: 1,
    fontSize: 15,
    color: '#ff6b6b',
    fontWeight: '500',
    lineHeight: 22,
  },
  responseContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  responseLabel: {
    fontSize: 12,
    color: '#6a6a8a',
    marginBottom: 6,
  },
  responseText: {
    fontSize: 14,
    color: '#81ecec',
    lineHeight: 20,
  },
  dateContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#6a6a8a',
  },
});
