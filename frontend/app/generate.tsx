import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface NewsItem {
  title: string;
  description: string;
  source: string;
}

export default function GenerateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedNews, setSelectedNews] = useState<Set<number>>(new Set());
  const [location, setLocation] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkLocationPermission();
    fetchNews();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        // Reverse geocode to get city name
        const [address] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (address) {
          setLocation(address.city || address.region || 'Italia');
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchNews = async () => {
    setLoadingNews(true);
    try {
      const response = await axios.get(`${API_URL}/api/news`, {
        params: { location },
      });
      setNews(response.data);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoadingNews(false);
    }
  };

  const toggleNewsSelection = (index: number) => {
    const newSelected = new Set(selectedNews);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedNews(newSelected);
  };

  const handleGenerate = async () => {
    if (!topic.trim() && selectedNews.size === 0) {
      Alert.alert(
        'Informazione richiesta',
        'Inserisci un argomento o seleziona almeno una notizia come spunto'
      );
      return;
    }

    setLoading(true);
    try {
      // Build news context from selected news
      let newsContext = null;
      if (selectedNews.size > 0) {
        const selectedNewsItems = Array.from(selectedNews).map((i) => news[i]);
        newsContext = selectedNewsItems
          .map((n) => `${n.title}: ${n.description}`)
          .join('; ');
      }

      const response = await axios.post(`${API_URL}/api/presentations/generate`, {
        topic: topic.trim() || null,
        news_context: newsContext,
        location: location,
      });

      Alert.alert(
        'Presentazione generata!',
        `"${response.data.title}" è stata creata con successo.`,
        [
          {
            text: 'Visualizza',
            onPress: () => {
              router.back();
              setTimeout(() => {
                router.push(`/presentation/${response.data.id}`);
              }, 100);
            },
          },
          {
            text: 'Torna alla lista',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error generating presentation:', error);
      Alert.alert(
        'Errore',
        error.response?.data?.detail || 'Impossibile generare la presentazione'
      );
    } finally {
      setLoading(false);
    }
  };

  const suggestedTopics = [
    'Speranza per il futuro',
    'La famiglia felice',
    'Perché esiste la sofferenza',
    'Cosa insegna la Bibbia',
    'Il Regno di Dio',
    'La risurrezione',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Info */}
        <View style={styles.headerInfo}>
          <Ionicons name="sparkles" size={32} color="#ffd700" />
          <Text style={styles.headerTitle}>Genera con AI</Text>
          <Text style={styles.headerSubtitle}>
            L'intelligenza artificiale creerà una presentazione personalizzata basata
            sull'argomento e sulle notizie selezionate
          </Text>
        </View>

        {/* Location */}
        {location && (
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={16} color="#00cec9" />
            <Text style={styles.locationText}>{location}</Text>
          </View>
        )}

        {/* Topic Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Argomento (opzionale)</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="Es: Speranza per il futuro"
            placeholderTextColor="#6a6a8a"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionsContainer}
          >
            {suggestedTopics.map((t, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.suggestionChip,
                  topic === t && styles.suggestionChipActive,
                ]}
                onPress={() => setTopic(t)}
              >
                <Text
                  style={[
                    styles.suggestionText,
                    topic === t && styles.suggestionTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* News Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Notizie di attualità</Text>
            <TouchableOpacity onPress={fetchNews} disabled={loadingNews}>
              <Ionicons
                name="refresh"
                size={20}
                color={loadingNews ? '#6a6a8a' : '#6c5ce7'}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Seleziona le notizie da usare come spunto per la presentazione
          </Text>

          {loadingNews ? (
            <ActivityIndicator color="#6c5ce7" style={{ marginTop: 16 }} />
          ) : (
            news.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.newsCard,
                  selectedNews.has(index) && styles.newsCardSelected,
                ]}
                onPress={() => toggleNewsSelection(index)}
                activeOpacity={0.7}
              >
                <View style={styles.newsCheckbox}>
                  <Ionicons
                    name={selectedNews.has(index) ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={selectedNews.has(index) ? '#6c5ce7' : '#6a6a8a'}
                  />
                </View>
                <View style={styles.newsContent}>
                  <Text style={styles.newsTitle}>{item.title}</Text>
                  <Text style={styles.newsDescription}>{item.description}</Text>
                  <Text style={styles.newsSource}>{item.source}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
          onPress={handleGenerate}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#000" />
              <Text style={styles.generateButtonText}>Generazione in corso...</Text>
            </>
          ) : (
            <>
              <Ionicons name="sparkles" size={24} color="#000" />
              <Text style={styles.generateButtonText}>Genera Presentazione</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  content: {
    padding: 16,
  },
  headerInfo: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8888aa',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 206, 201, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 16,
  },
  locationText: {
    color: '#00cec9',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#6a6a8a',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  suggestionsContainer: {
    marginTop: 12,
  },
  suggestionChip: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  suggestionChipActive: {
    backgroundColor: '#6c5ce7',
    borderColor: '#6c5ce7',
  },
  suggestionText: {
    color: '#8888aa',
    fontSize: 13,
  },
  suggestionTextActive: {
    color: '#fff',
  },
  newsCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  newsCardSelected: {
    borderColor: '#6c5ce7',
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
  },
  newsCheckbox: {
    marginRight: 12,
    justifyContent: 'center',
  },
  newsContent: {
    flex: 1,
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  newsDescription: {
    fontSize: 13,
    color: '#8888aa',
    lineHeight: 18,
  },
  newsSource: {
    fontSize: 11,
    color: '#6a6a8a',
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0f0f1a',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  generateButton: {
    backgroundColor: '#ffd700',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
