import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Presentation {
  id: string;
  title: string;
  intro: string;
  topic?: string;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPresentations = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/presentations`);
      setPresentations(response.data);
    } catch (error) {
      console.error('Error fetching presentations:', error);
      Alert.alert('Errore', 'Impossibile caricare le presentazioni');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPresentations();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPresentations();
  };

  const deletePresentation = async (id: string) => {
    const performDelete = async () => {
      try {
        await axios.delete(`${API_URL}/api/presentations/${id}`);
        setPresentations((prev) => prev.filter((p) => p.id !== id));
      } catch (error) {
        console.error('Error deleting presentation:', error);
        if (Platform.OS === 'web') {
          window.alert('Errore: Impossibile eliminare la presentazione');
        } else {
          Alert.alert('Errore', 'Impossibile eliminare la presentazione');
        }
      }
    };

    if (Platform.OS === 'web') {
      // Use window.confirm on web since Alert.alert doesn't work well
      const confirmed = window.confirm('Vuoi davvero eliminare questa presentazione?');
      if (confirmed) {
        await performDelete();
      }
    } else {
      Alert.alert(
        'Conferma eliminazione',
        'Vuoi davvero eliminare questa presentazione?',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Elimina',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const renderItem = ({ item }: { item: Presentation }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/presentation/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.is_ai_generated && (
            <View style={styles.aiBadge}>
              <Ionicons name="sparkles" size={12} color="#ffd700" />
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          )}
        </View>
        {item.topic && (
          <Text style={styles.cardTopic}>{item.topic}</Text>
        )}
      </View>
      <Text style={styles.cardIntro} numberOfLines={2}>
        {item.intro}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardDate}>
          {new Date(item.updated_at).toLocaleDateString('it-IT')}
        </Text>
        <TouchableOpacity
          onPress={() => deletePresentation(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={80} color="#4a4a6a" />
      <Text style={styles.emptyTitle}>Nessuna presentazione</Text>
      <Text style={styles.emptySubtitle}>
        Crea la tua prima presentazione o genera una con l'AI
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6c5ce7" />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={presentations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          presentations.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6c5ce7"
            colors={['#6c5ce7']}
          />
        }
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => router.push('/generate')}
          activeOpacity={0.8}
        >
          <Text style={styles.fabTextGold}>AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, styles.fabPrimary]}
          onPress={() => router.push('/create')}
          activeOpacity={0.8}
        >
          <Text style={styles.fabTextWhite}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  aiBadgeText: {
    color: '#ffd700',
    fontSize: 10,
    fontWeight: '700',
  },
  cardTopic: {
    fontSize: 12,
    color: '#6c5ce7',
    marginTop: 4,
  },
  cardIntro: {
    fontSize: 14,
    color: '#8888aa',
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
  },
  cardDate: {
    fontSize: 12,
    color: '#6a6a8a',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8888aa',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    flexDirection: 'column',
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabPrimary: {
    backgroundColor: '#6c5ce7',
  },
  fabSecondary: {
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#ffd700',
  },
});
