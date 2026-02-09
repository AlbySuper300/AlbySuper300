import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

export default function ScriptureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { url, reference } = useLocalSearchParams<{ url: string; reference: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!url) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
        <Text style={styles.errorText}>URL non disponibile</Text>
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

      {/* WebView */}
      <View style={styles.webviewContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6c5ce7" />
            <Text style={styles.loadingText}>Caricamento scrittura...</Text>
          </View>
        )}

        {error ? (
          <View style={[styles.centered, { flex: 1 }]}>
            <Ionicons name="cloud-offline" size={48} color="#ff6b6b" />
            <Text style={styles.errorText}>Impossibile caricare la scrittura</Text>
            <Text style={styles.errorHint}>Verifica la connessione internet</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setError(false);
                setLoading(true);
              }}
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Riprova</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            onHttpError={() => {
              setLoading(false);
              setError(true);
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
            allowsInlineMediaPlayback={true}
            injectedJavaScript={`
              // Remove header and footer for cleaner view
              const header = document.querySelector('header');
              const footer = document.querySelector('footer');
              const nav = document.querySelector('nav');
              if (header) header.style.display = 'none';
              if (footer) footer.style.display = 'none';
              if (nav) nav.style.display = 'none';
              
              // Improve readability
              document.body.style.fontSize = '18px';
              document.body.style.lineHeight = '1.6';
              document.body.style.padding = '16px';
              
              true;
            `}
          />
        )}
      </View>

      {/* Info Footer */}
      <View style={styles.footer}>
        <Ionicons name="information-circle" size={16} color="#6a6a8a" />
        <Text style={styles.footerText}>Contenuto da wol.jw.org</Text>
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
    padding: 12,
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
    gap: 8,
  },
  reference: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00cec9',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f0f1a',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#8888aa',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  errorHint: {
    color: '#6a6a8a',
    fontSize: 14,
    marginTop: 4,
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6c5ce7',
    borderRadius: 8,
    gap: 8,
  },
  retryButtonText: {
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
