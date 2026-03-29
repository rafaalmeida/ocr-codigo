import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCapture } from '../src/context/CaptureContext';
import { ChipSelector } from '../src/components/ChipSelector';

const QUICK_OPTIONS = ['Codigos', 'Telefones', 'E-mails', 'CPF/CNPJ'];
const API_KEY_STORAGE = '@ocr_api_key';

export default function HomeScreen() {
  const router = useRouter();
  const { dispatch } = useCapture();
  const [context, setContext] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedChip, setSelectedChip] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(API_KEY_STORAGE).then(key => {
      if (key) setApiKey(key);
    });
  }, []);

  const handleChipSelect = (option: string) => {
    setSelectedChip(option);
    setContext(option);
  };

  const handleStart = async () => {
    if (!context.trim()) {
      Alert.alert('Atenção', 'Descreva o que deseja capturar.');
      return;
    }
    if (!apiKey.trim()) {
      Alert.alert(
        'API Key necessaria',
        'Insira sua Google Cloud Vision API Key para usar o OCR.'
      );
      return;
    }

    await AsyncStorage.setItem(API_KEY_STORAGE, apiKey.trim());
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_CONTEXT', payload: context.trim() });
    dispatch({ type: 'SET_API_KEY', payload: apiKey.trim() });
    router.push('/camera');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.icon}>📷</Text>
            <Text style={styles.title}>O que voce deseja capturar?</Text>
            <Text style={styles.subtitle}>
              Descreva o tipo de dado para que o app ajuste a captura automatica.
            </Text>
          </View>

          {/* Quick options */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Sugestoes rapidas</Text>
            <ChipSelector
              options={QUICK_OPTIONS}
              selected={selectedChip}
              onSelect={handleChipSelect}
            />
          </View>

          {/* Context input */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ou descreva manualmente</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: codigos de barras em cartoes de presente"
              placeholderTextColor="#999"
              value={context}
              onChangeText={text => {
                setContext(text);
                setSelectedChip('');
              }}
              multiline
            />
          </View>

          {/* API Key */}
          <View style={styles.section}>
            <View style={styles.apiKeyHeader}>
              <Text style={styles.sectionLabel}>Google Cloud Vision API Key</Text>
              <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)}>
                <Text style={styles.toggleText}>
                  {showApiKey ? 'Ocultar' : 'Mostrar'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Insira sua API Key"
              placeholderTextColor="#999"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Crie uma API Key gratuita em console.cloud.google.com com a Cloud Vision API habilitada. Free tier: 1000 requests/mes.
            </Text>
          </View>

          {/* Start button */}
          <TouchableOpacity
            style={[
              styles.startButton,
              (!context.trim() || !apiKey.trim()) && styles.startButtonDisabled,
            ]}
            onPress={handleStart}
            disabled={!context.trim() || !apiKey.trim()}
          >
            <Text style={styles.startButtonText}>Iniciar Captura</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fafafa',
    minHeight: 50,
  },
  apiKeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#1a73e8',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    lineHeight: 16,
  },
  startButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  startButtonDisabled: {
    backgroundColor: '#b0c4de',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
