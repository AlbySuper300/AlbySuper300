import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [topic, setTopic] = useState('');
  const [mainPoints, setMainPoints] = useState(['']);
  const [questions, setQuestions] = useState(['']);
  const [scriptures, setScriptures] = useState(['']);
  const [objections, setObjections] = useState([{ objection: '', response: '' }]);

  const addItem = (setter: Function, items: any[], defaultValue: any) => {
    setter([...items, defaultValue]);
  };

  const updateItem = (setter: Function, items: any[], index: number, value: any) => {
    const newItems = [...items];
    newItems[index] = value;
    setter(newItems);
  };

  const removeItem = (setter: Function, items: any[], index: number) => {
    if (items.length > 1) {
      setter(items.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Errore', 'Inserisci un titolo per la presentazione');
      return;
    }
    if (!intro.trim()) {
      Alert.alert('Errore', 'Inserisci una frase di apertura');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        intro: intro.trim(),
        topic: topic.trim() || null,
        main_points: mainPoints.filter((p) => p.trim()),
        questions: questions.filter((q) => q.trim()),
        scriptures: scriptures
          .filter((s) => s.trim())
          .map((s) => ({ reference: s.trim() })),
        objections: objections.filter(
          (o) => o.objection.trim() && o.response.trim()
        ),
      };

      await axios.post(`${API_URL}/api/presentations`, payload);
      Alert.alert('Successo', 'Presentazione salvata!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error saving presentation:', error);
      Alert.alert('Errore', 'Impossibile salvare la presentazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Titolo *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Es: La speranza del Regno"
            placeholderTextColor="#6a6a8a"
          />
        </View>

        {/* Topic */}
        <View style={styles.section}>
          <Text style={styles.label}>Argomento</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="Es: Speranza, Famiglia, Pace"
            placeholderTextColor="#6a6a8a"
          />
        </View>

        {/* Intro */}
        <View style={styles.section}>
          <Text style={styles.label}>Frase di apertura *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={intro}
            onChangeText={setIntro}
            placeholder="Come iniziare la conversazione..."
            placeholderTextColor="#6a6a8a"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Main Points */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Punti principali</Text>
            <TouchableOpacity
              onPress={() => addItem(setMainPoints, mainPoints, '')}
              style={styles.addButton}
            >
              <Text style={styles.addIcon}>＋</Text>
            </TouchableOpacity>
          </View>
          {mainPoints.map((point, index) => (
            <View key={index} style={styles.listItem}>
              <TextInput
                style={[styles.input, styles.listInput]}
                value={point}
                onChangeText={(v) => updateItem(setMainPoints, mainPoints, index, v)}
                placeholder={`Punto ${index + 1}`}
                placeholderTextColor="#6a6a8a"
              />
              {mainPoints.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeItem(setMainPoints, mainPoints, index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeIcon}>－</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Questions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Domande da porre</Text>
            <TouchableOpacity
              onPress={() => addItem(setQuestions, questions, '')}
              style={styles.addButton}
            >
              <Text style={styles.addIcon}>＋</Text>
            </TouchableOpacity>
          </View>
          {questions.map((question, index) => (
            <View key={index} style={styles.listItem}>
              <TextInput
                style={[styles.input, styles.listInput]}
                value={question}
                onChangeText={(v) => updateItem(setQuestions, questions, index, v)}
                placeholder={`Domanda ${index + 1}`}
                placeholderTextColor="#6a6a8a"
              />
              {questions.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeItem(setQuestions, questions, index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeIcon}>－</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Scriptures */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Scritture bibliche</Text>
            <TouchableOpacity
              onPress={() => addItem(setScriptures, scriptures, '')}
              style={styles.addButton}
            >
              <Text style={styles.addIcon}>＋</Text>
            </TouchableOpacity>
          </View>
          {scriptures.map((scripture, index) => (
            <View key={index} style={styles.listItem}>
              <TextInput
                style={[styles.input, styles.listInput]}
                value={scripture}
                onChangeText={(v) => updateItem(setScriptures, scriptures, index, v)}
                placeholder="Es: Giovanni 3:16"
                placeholderTextColor="#6a6a8a"
              />
              {scriptures.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeItem(setScriptures, scriptures, index)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeIcon}>－</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <Text style={styles.hint}>
            Le scritture saranno cliccabili e collegate a wol.jw.org
          </Text>
        </View>

        {/* Objections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Obiezioni e risposte</Text>
            <TouchableOpacity
              onPress={() =>
                addItem(setObjections, objections, { objection: '', response: '' })
              }
              style={styles.addButton}
            >
              <Text style={styles.addIcon}>＋</Text>
            </TouchableOpacity>
          </View>
          {objections.map((obj, index) => (
            <View key={index} style={styles.objectionCard}>
              <TextInput
                style={styles.input}
                value={obj.objection}
                onChangeText={(v) =>
                  updateItem(setObjections, objections, index, {
                    ...obj,
                    objection: v,
                  })
                }
                placeholder="Obiezione comune..."
                placeholderTextColor="#6a6a8a"
              />
              <TextInput
                style={[styles.input, styles.textArea, { marginTop: 8 }]}
                value={obj.response}
                onChangeText={(v) =>
                  updateItem(setObjections, objections, index, {
                    ...obj,
                    response: v,
                  })
                }
                placeholder="Come rispondere..."
                placeholderTextColor="#6a6a8a"
                multiline
                numberOfLines={2}
              />
              {objections.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeItem(setObjections, objections, index)}
                  style={styles.removeButtonAbsolute}
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.checkIcon}>✓</Text>
              <Text style={styles.saveButtonText}>Salva Presentazione</Text>
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  listInput: {
    flex: 1,
  },
  addButton: {
    padding: 4,
  },
  removeButton: {
    marginLeft: 8,
  },
  removeButtonAbsolute: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  hint: {
    fontSize: 12,
    color: '#6a6a8a',
    marginTop: 4,
    fontStyle: 'italic',
  },
  objectionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    position: 'relative',
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
  saveButton: {
    backgroundColor: '#6c5ce7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
