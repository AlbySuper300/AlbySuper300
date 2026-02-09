import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

// Only import WebView for native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}

export default function ScriptureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { url, reference } = useLocalSearchParams<{ url: string; reference: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const openInBrowser = async () => {
    if (url) {
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch (e) {
        // Fallback to Linking
        Linking.openURL(url);
      }
    }
  };

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

  // For web platform, show a preview with option to open externally
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        {/* Reference Header */}
        <View style={styles.header}>
          <Ionicons name="book" size={20} color="#00cec9" />
          <Text style={styles.reference}>{reference || 'Scrittura'}</Text>
        </View>

        {/* Content for Web */}
        <View style={styles.webContent}>
          <View style={styles.iconContainer}>
            <Ionicons name="document-text" size={80} color="#6c5ce7" />
          </View>
          
          <Text style={styles.webTitle}>{reference}</Text>
          <Text style={styles.webSubtitle}>
            Tocca il pulsante per leggere questa scrittura sul sito ufficiale wol.jw.org
          </Text>

          <TouchableOpacity
            style={styles.openButton}
            onPress={openInBrowser}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={24} color="#fff" />
            <Text style={styles.openButtonText}>Apri su wol.jw.org</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(url);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={20} color="#6c5ce7" />
            <Text style={styles.copyButtonText}>Copia link</Text>
          </TouchableOpacity>
        </View>

        {/* Info Footer */}
        <View style={styles.footer}>
          <Ionicons name="information-circle" size={16} color="#6a6a8a" />
          <Text style={styles.footerText}>Contenuto da wol.jw.org</Text>
        </View>
      </View>
    );
  }

  // For native platforms, use WebView
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Reference Header */}
      <View style={styles.header}>
        <Ionicons name="book" size={20} color="#00cec9" />
        <Text style={styles.reference}>{reference || 'Scrittura'}</Text>
        <TouchableOpacity onPress={openInBrowser} style={styles.externalButton}>
          <Ionicons name="open-outline" size={20} color="#6c5ce7" />
        </TouchableOpacity>
      </View>

      {/* WebView for native */}
      <View style={styles.webviewContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6c5ce7" />
            <Text style={styles.loadingText}>Caricamento scrittura...</Text>
          </View>
        )}

        {error ? (
          <View style={[styles.centered, { flex: 1, backgroundColor: '#0f0f1a' }]}>
            <Ionicons name="cloud-offline" size={48} color="#ff6b6b" />
            <Text style={styles.errorText}>Impossibile caricare la scrittura</Text>
            <Text style={styles.errorHint}>Verifica la connessione internet</Text>
            
            <TouchableOpacity
              style={styles.openButton}
              onPress={openInBrowser}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={20} color="#fff" />
              <Text style={styles.openButtonText}>Apri nel browser</Text>
            </TouchableOpacity>

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
          WebView && (
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
          )
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
    flex: 1,
    textAlign: 'center',
  },
  externalButton: {
    padding: 4,
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
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2a2a4a',
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
  // Web-specific styles
  webContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  webTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  webSubtitle: {
    fontSize: 15,
    color: '#8888aa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c5ce7',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6c5ce7',
    gap: 8,
  },
  copyButtonText: {
    color: '#6c5ce7',
    fontSize: 14,
    fontWeight: '600',
  },
});
