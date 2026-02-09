import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

export default function ScriptureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { url, reference, text: initialText } = useLocalSearchParams<{ 
    url: string; 
    reference: string;
    text?: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [scriptureText, setScriptureText] = useState<string | null>(initialText || null);

  const openInBrowser = async () => {
    if (url) {
      try {
        if (Platform.OS === 'web') {
          window.open(url, '_blank');
        } else {
          await WebBrowser.openBrowserAsync(url);
        }
      } catch (e) {
        Linking.openURL(url);
      }
    }
  };

  if (!url && !scriptureText) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
        <Text style={styles.errorText}>Scrittura non disponibile</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Reference Header */}
      <View style={styles.header}>
        <Ionicons name="book" size={20} color="#00cec9" />
        <Text style={styles.reference}>{reference || 'Scrittura'}</Text>
      </View>

      {/* Scripture Content */}
      <ScrollView 
        style={styles.contentContainer}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6c5ce7" />
            <Text style={styles.loadingText}>Caricamento scrittura...</Text>
          </View>
        ) : scriptureText ? (
          <>
            {/* Scripture Text Display */}
            <View style={styles.scriptureCard}>
              <View style={styles.quoteIcon}>
                <Ionicons name="book-outline" size={32} color="#6c5ce7" />
              </View>
              <Text style={styles.scriptureText}>{scriptureText}</Text>
              <Text style={styles.scriptureRef}>— {reference}</Text>
            </View>

            {/* Source info */}
            <View style={styles.sourceInfo}>
              <Ionicons name="checkmark-circle" size={16} color="#00cec9" />
              <Text style={styles.sourceText}>
                Traduzione del Nuovo Mondo delle Sacre Scritture
              </Text>
            </View>
          </>
        ) : (
          /* No text available - show prompt to open web */
          <View style={styles.noTextContainer}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text" size={64} color="#6c5ce7" />
            </View>
            <Text style={styles.noTextTitle}>{reference}</Text>
            <Text style={styles.noTextSubtitle}>
              Il testo non è stato caricato. Puoi leggerlo direttamente sul sito ufficiale.
            </Text>
          </View>
        )}

        {/* Web Option - Secondary */}
        <View style={styles.webOptionContainer}>
          <Text style={styles.webOptionLabel}>
            {scriptureText ? 'Vuoi leggere di più?' : 'Leggi la scrittura completa:'}
          </Text>
          <TouchableOpacity
            style={styles.webButton}
            onPress={openInBrowser}
            activeOpacity={0.8}
          >
            <Ionicons name="globe-outline" size={20} color="#fff" />
            <Text style={styles.webButtonText}>Apri su wol.jw.org</Text>
            <Ionicons name="open-outline" size={16} color="#fff" />
          </TouchableOpacity>

          {Platform.OS === 'web' && url && (
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(url);
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={18} color="#6c5ce7" />
              <Text style={styles.copyButtonText}>Copia link</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Ionicons name="information-circle" size={16} color="#6a6a8a" />
        <Text style={styles.footerText}>Fonte: wol.jw.org</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
    gap: 8,
  },
  reference: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00cec9',
  },
  contentContainer: {
    flex: 1,
  },
  contentInner: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#8888aa',
    marginTop: 12,
    fontSize: 14,
  },
  scriptureCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#6c5ce7',
    marginBottom: 16,
  },
  quoteIcon: {
    marginBottom: 16,
  },
  scriptureText: {
    fontSize: 18,
    color: '#e0e0e0',
    lineHeight: 28,
    fontStyle: 'italic',
  },
  scriptureRef: {
    fontSize: 14,
    color: '#00cec9',
    marginTop: 16,
    textAlign: 'right',
    fontWeight: '600',
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  sourceText: {
    fontSize: 12,
    color: '#6a6a8a',
    fontStyle: 'italic',
  },
  noTextContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noTextTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  noTextSubtitle: {
    fontSize: 14,
    color: '#8888aa',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  webOptionContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    marginTop: 8,
  },
  webOptionLabel: {
    fontSize: 14,
    color: '#8888aa',
    marginBottom: 12,
  },
  webButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a4a',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  webButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6c5ce7',
    gap: 6,
  },
  copyButtonText: {
    color: '#6c5ce7',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6c5ce7',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    gap: 6,
  },
  footerText: {
    color: '#6a6a8a',
    fontSize: 12,
  },
});
