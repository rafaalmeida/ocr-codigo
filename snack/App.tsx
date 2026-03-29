import React, { useState, useRef, useEffect, useCallback, createContext, useContext, useReducer } from 'react';
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
  Modal,
  FlatList,
  ActivityIndicator,
  Vibration,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// TYPES
// ============================================================

interface CaptureItem {
  id: string;
  value: string;
  timestamp: Date;
}

interface Pattern {
  regex: RegExp;
  length: number;
  description: string;
}

interface CaptureState {
  context: string;
  apiKey: string;
  pattern: Pattern | null;
  confirmedExample: string | null;
  captures: CaptureItem[];
}

type Action =
  | { type: 'SET_CONTEXT'; payload: string }
  | { type: 'SET_API_KEY'; payload: string }
  | { type: 'SET_PATTERN'; payload: { pattern: Pattern; example: string } }
  | { type: 'ADD_CAPTURE'; payload: CaptureItem }
  | { type: 'REMOVE_CAPTURE'; payload: string }
  | { type: 'RESET' };

type Screen = 'home' | 'camera' | 'results';

// ============================================================
// CONTEXT / STATE
// ============================================================

const initialState: CaptureState = {
  context: '',
  apiKey: '',
  pattern: null,
  confirmedExample: null,
  captures: [],
};

function captureReducer(state: CaptureState, action: Action): CaptureState {
  switch (action.type) {
    case 'SET_CONTEXT':
      return { ...state, context: action.payload };
    case 'SET_API_KEY':
      return { ...state, apiKey: action.payload };
    case 'SET_PATTERN':
      return { ...state, pattern: action.payload.pattern, confirmedExample: action.payload.example };
    case 'ADD_CAPTURE': {
      if (state.captures.some(c => c.value === action.payload.value)) return state;
      return { ...state, captures: [...state.captures, action.payload] };
    }
    case 'REMOVE_CAPTURE':
      return { ...state, captures: state.captures.filter(c => c.id !== action.payload) };
    case 'RESET':
      return { ...initialState, apiKey: state.apiKey };
    default:
      return state;
  }
}

// ============================================================
// OCR UTILS
// ============================================================

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

async function recognizeText(base64Image: string, apiKey: string): Promise<{ text: string }[]> {
  const body = {
    requests: [{
      image: { content: base64Image },
      features: [{ type: 'TEXT_DETECTION', maxResults: 50 }],
    }],
  };

  const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro na API Vision: ${response.status}`);
  }

  const data = await response.json();
  const annotations = data.responses?.[0]?.textAnnotations;
  if (!annotations || annotations.length === 0) return [];
  return annotations.slice(1).map((a: any) => ({ text: a.description.trim() }));
}

// ============================================================
// PATTERN UTILS
// ============================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferPattern(confirmedText: string): Pattern {
  const text = confirmedText.trim();
  const len = text.length;
  const hasDigits = /\d/.test(text);
  const hasLetters = /[a-zA-Z]/.test(text);
  const hasSpecial = /[^a-zA-Z0-9]/.test(text);

  const groups: string[] = [];
  let currentType = '';
  let currentCount = 0;

  for (const char of text) {
    let type: string;
    if (/\d/.test(char)) type = 'digit';
    else if (/[a-zA-Z]/.test(char)) type = 'alpha';
    else type = 'literal:' + char;

    if (type === currentType) {
      currentCount++;
    } else {
      if (currentType) groups.push(`${currentType}:${currentCount}`);
      currentType = type;
      currentCount = 1;
    }
  }
  if (currentType) groups.push(`${currentType}:${currentCount}`);

  const parts = groups.map(group => {
    const colonIdx = group.indexOf(':');
    const type = group.substring(0, colonIdx);
    const count = parseInt(group.substring(colonIdx + 1), 10);

    if (type === 'digit') {
      return `\\d{${Math.max(1, count - 1)},${count + 1}}`;
    } else if (type === 'alpha') {
      return `[a-zA-Z]{${Math.max(1, count - 1)},${count + 1}}`;
    } else {
      const literal = type.replace('literal:', '');
      return escapeRegex(literal);
    }
  });

  let description = '';
  if (hasDigits && !hasLetters && !hasSpecial) description = `Numero com ${len} digitos`;
  else if (hasDigits && !hasLetters) description = `Codigo numerico formatado (${len} chars)`;
  else if (hasLetters && hasDigits) description = `Codigo alfanumerico (${len} chars)`;
  else if (hasLetters) description = `Texto alfabetico (${len} chars)`;
  else description = `Padrao com ${len} chars`;

  return { regex: new RegExp(`^${parts.join('')}$`), length: len, description };
}

function findMatchingTexts(texts: string[], pattern: Pattern): string[] {
  return texts.map(t => t.trim()).filter(t => t.length > 0 && pattern.regex.test(t));
}

// ============================================================
// CSV UTILS
// ============================================================

function generateCSV(items: CaptureItem[], context: string): string {
  const BOM = '\uFEFF';
  const header = 'Indice,Dado Capturado,Data/Hora,Contexto';
  const rows = items.map((item, i) => {
    const d = new Date(item.timestamp);
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    const val = item.value.includes(',') ? `"${item.value}"` : item.value;
    const ctx = context.includes(',') ? `"${context}"` : context;
    return `${i + 1},${val},${date},${ctx}`;
  });
  return BOM + [header, ...rows].join('\n');
}

async function saveAndShareCSV(items: CaptureItem[], context: string) {
  const csv = generateCSV(items, context);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const path = `${FileSystem.documentDirectory}captura_${ts}.csv`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Compartilhar capturas', UTI: 'public.comma-separated-values-text' });
  } else {
    Alert.alert('Erro', 'Compartilhamento nao disponivel neste dispositivo.');
  }
}

// ============================================================
// HOME SCREEN
// ============================================================

const QUICK_OPTIONS = ['Codigos', 'Telefones', 'E-mails', 'CPF/CNPJ'];

function HomeScreen({ onNavigate, dispatch }: { onNavigate: (s: Screen) => void; dispatch: React.Dispatch<Action> }) {
  const [context, setContext] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedChip, setSelectedChip] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@ocr_api_key').then(key => { if (key) setApiKey(key); });
  }, []);

  const handleStart = async () => {
    if (!context.trim()) { Alert.alert('Atencao', 'Descreva o que deseja capturar.'); return; }
    if (!apiKey.trim()) { Alert.alert('API Key necessaria', 'Insira sua Google Cloud Vision API Key.'); return; }
    await AsyncStorage.setItem('@ocr_api_key', apiKey.trim());
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_CONTEXT', payload: context.trim() });
    dispatch({ type: 'SET_API_KEY', payload: apiKey.trim() });
    onNavigate('camera');
  };

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📷</Text>
            <Text style={s.title}>O que voce deseja capturar?</Text>
            <Text style={s.subtitle}>Descreva o tipo de dado para que o app ajuste a captura automatica.</Text>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Sugestoes rapidas</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {QUICK_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.chip, selectedChip === opt && s.chipSelected]}
                  onPress={() => { setSelectedChip(opt); setContext(opt); }}
                >
                  <Text style={[s.chipText, selectedChip === opt && s.chipTextSelected]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Ou descreva manualmente</Text>
            <TextInput
              style={s.input}
              placeholder="Ex: codigos de barras em cartoes de presente"
              placeholderTextColor="#999"
              value={context}
              onChangeText={t => { setContext(t); setSelectedChip(''); }}
              multiline
            />
          </View>

          <View style={s.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={s.sectionLabel}>Google Cloud Vision API Key</Text>
              <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)}>
                <Text style={{ fontSize: 14, color: '#1a73e8', fontWeight: '600' }}>{showApiKey ? 'Ocultar' : 'Mostrar'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.input}
              placeholder="Insira sua API Key"
              placeholderTextColor="#999"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={s.hint}>Crie uma API Key gratuita em console.cloud.google.com com Cloud Vision API habilitada. Free tier: 1000 req/mes.</Text>
          </View>

          <TouchableOpacity
            style={[s.startButton, (!context.trim() || !apiKey.trim()) && s.startButtonDisabled]}
            onPress={handleStart}
            disabled={!context.trim() || !apiKey.trim()}
          >
            <Text style={s.startButtonText}>Iniciar Captura</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// CAMERA SCREEN
// ============================================================

type CaptureMode = 'manual' | 'confirming' | 'auto';

function CameraScreen({ onNavigate, state, dispatch }: { onNavigate: (s: Screen) => void; state: CaptureState; dispatch: React.Dispatch<Action> }) {
  const cameraRef = useRef<CameraView>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<CaptureMode>('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedTexts, setDetectedTexts] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  }, []);

  const captureAndProcess = useCallback(async (): Promise<string[]> => {
    if (!cameraRef.current || isProcessingRef.current) return [];
    isProcessingRef.current = true;
    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6, skipProcessing: true });
      if (!photo?.base64) throw new Error('Falha ao capturar foto');
      const blocks = await recognizeText(photo.base64, state.apiKey);
      return blocks.map(b => b.text).filter(t => t.length > 0);
    } catch (error: any) {
      if (!isProcessingRef.current) Alert.alert('Erro no OCR', error.message || 'Erro desconhecido');
      return [];
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  }, [state.apiKey]);

  const handleManualCapture = async () => {
    const texts = await captureAndProcess();
    if (texts.length > 0) {
      setDetectedTexts(texts);
      setShowModal(true);
      setMode('confirming');
    } else {
      Alert.alert('Nenhum texto', 'Nenhum texto foi detectado. Tente novamente.');
    }
  };

  const handleConfirm = (selectedText: string) => {
    setShowModal(false);
    const pattern = inferPattern(selectedText);
    dispatch({ type: 'SET_PATTERN', payload: { pattern, example: selectedText } });
    dispatch({ type: 'ADD_CAPTURE', payload: { id: Date.now().toString(), value: selectedText, timestamp: new Date() } });
    Vibration.vibrate(100);
    setMode('auto');

    // Start auto capture
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    autoTimerRef.current = setInterval(async () => {
      const texts = await captureAndProcess();
      if (texts.length === 0) return;
      const matches = findMatchingTexts(texts, pattern);
      for (const match of matches) {
        dispatch({ type: 'ADD_CAPTURE', payload: { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, value: match, timestamp: new Date() } });
        Vibration.vibrate(50);
      }
    }, 2500);
  };

  const handleStop = () => {
    if (autoTimerRef.current) { clearInterval(autoTimerRef.current); autoTimerRef.current = null; }
    onNavigate('results');
  };

  if (!permission) return <View style={s.centered}><ActivityIndicator size="large" color="#1a73e8" /></View>;

  if (!permission.granted) {
    return (
      <View style={s.centered}>
        <Text style={{ fontSize: 16, color: '#333', textAlign: 'center', marginBottom: 20, lineHeight: 24 }}>
          O app precisa de acesso a camera para funcionar.
        </Text>
        <TouchableOpacity style={s.permButton} onPress={requestPermission}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Permitir Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.flex}>
      <CameraView ref={cameraRef} style={s.flex} facing="back">
        {/* Overlay */}
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60 }}>
            <Text style={s.overlayBadge} numberOfLines={1}>{state.context}</Text>
            {mode === 'auto' && (
              <View style={s.recordingBadge}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Capturando</Text>
              </View>
            )}
          </View>
          {/* Guide corners */}
          <View style={s.guideBox}>
            <View style={[s.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[s.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
            <View style={[s.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[s.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
          </View>
          {state.captures.length > 0 && (
            <View style={s.counterBadge}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                {state.captures.length} {state.captures.length === 1 ? 'item capturado' : 'itens capturados'}
              </Text>
            </View>
          )}
        </View>
      </CameraView>

      {/* Bottom controls */}
      <View style={s.bottomControls}>
        {/* Mini list */}
        {state.captures.length > 0 && (
          <View style={s.miniList}>
            {[...state.captures].reverse().slice(0, 5).map((item, i) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, gap: 8 }}>
                <Text style={{ color: '#999', fontSize: 12, width: 24, textAlign: 'right' }}>{state.captures.length - i}</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'monospace', fontWeight: '600' }} numberOfLines={1}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, gap: 16 }}>
          {mode === 'manual' && (
            <TouchableOpacity style={s.captureBtn} onPress={handleManualCapture} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Capturar</Text>}
            </TouchableOpacity>
          )}
          {mode === 'auto' && (
            <>
              {isProcessing && <ActivityIndicator color="#1a73e8" size="small" />}
              <TouchableOpacity style={s.stopBtn} onPress={handleStop}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Parar Captura</Text>
              </TouchableOpacity>
            </>
          )}
          {mode === 'confirming' && isProcessing && <ActivityIndicator color="#1a73e8" size="large" />}
        </View>
      </View>

      {/* Confirmation Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 4 }}>Textos Detectados</Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>Selecione o dado que deseja capturar:</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {detectedTexts.length === 0 ? (
                <Text style={{ fontSize: 14, color: '#999', textAlign: 'center', padding: 20 }}>Nenhum texto detectado.</Text>
              ) : (
                detectedTexts.map((text, i) => (
                  <TouchableOpacity key={`${text}-${i}`} style={s.textItem} onPress={() => handleConfirm(text)}>
                    <Text style={{ fontSize: 16, color: '#1a73e8', fontWeight: '600', fontFamily: 'monospace' }}>{text}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowModal(false); setMode('manual'); }}>
              <Text style={{ fontSize: 16, color: '#666', fontWeight: '600' }}>Cancelar e Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================================
// RESULTS SCREEN
// ============================================================

function ResultScreen({ onNavigate, state, dispatch }: { onNavigate: (s: Screen) => void; state: CaptureState; dispatch: React.Dispatch<Action> }) {
  const formatTime = (date: Date) => {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const handleShare = async () => {
    if (state.captures.length === 0) { Alert.alert('Sem dados', 'Nenhum dado capturado.'); return; }
    try { await saveAndShareCSV(state.captures, state.context); } catch (e: any) { Alert.alert('Erro', e.message); }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.resultsHeader}>
        <TouchableOpacity onPress={() => onNavigate('camera')} style={{ paddingRight: 16 }}>
          <Text style={{ fontSize: 18, color: '#1a73e8', fontWeight: '700' }}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#333' }}>Resultados</Text>
      </View>

      <View style={s.summary}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 4 }}>
          {state.captures.length} {state.captures.length === 1 ? 'item capturado' : 'itens capturados'}
        </Text>
        <Text style={{ fontSize: 14, color: '#666' }}>Contexto: {state.context}</Text>
        {state.pattern && <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Padrao: {state.pattern.description}</Text>}
      </View>

      {state.captures.length === 0 ? (
        <View style={s.centered}><Text style={{ fontSize: 16, color: '#999' }}>Nenhum dado capturado.</Text></View>
      ) : (
        <FlatList
          data={state.captures}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item, index }) => (
            <View style={s.resultItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                <Text style={{ fontSize: 14, color: '#999', width: 28, textAlign: 'center', fontWeight: '600' }}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, color: '#333', fontWeight: '600', fontFamily: 'monospace' }}>{item.value}</Text>
                  <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{formatTime(item.timestamp)}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.deleteBtn} onPress={() => dispatch({ type: 'REMOVE_CAPTURE', payload: item.id })}>
                <Text style={{ color: '#ea4335', fontSize: 14, fontWeight: '700' }}>X</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.shareBtn, state.captures.length === 0 && { backgroundColor: '#ccc' }]}
          onPress={handleShare}
          disabled={state.captures.length === 0}
        >
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Compartilhar CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.newCaptureBtn} onPress={() => { dispatch({ type: 'RESET' }); onNavigate('home'); }}>
          <Text style={{ color: '#333', fontSize: 16, fontWeight: '600' }}>Nova Captura</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [state, dispatch] = useReducer(captureReducer, initialState);
  const [screen, setScreen] = useState<Screen>('home');

  switch (screen) {
    case 'home':
      return <HomeScreen onNavigate={setScreen} dispatch={dispatch} />;
    case 'camera':
      return <CameraScreen onNavigate={setScreen} state={state} dispatch={dispatch} />;
    case 'results':
      return <ResultScreen onNavigate={setScreen} state={state} dispatch={dispatch} />;
  }
}

// ============================================================
// STYLES
// ============================================================

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 32 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, fontSize: 16, color: '#333', backgroundColor: '#fafafa', minHeight: 50 },
  hint: { fontSize: 12, color: '#999', marginTop: 8, lineHeight: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd' },
  chipSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  chipText: { fontSize: 14, color: '#333' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  startButton: { backgroundColor: '#1a73e8', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  startButtonDisabled: { backgroundColor: '#b0c4de' },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  permButton: { backgroundColor: '#1a73e8', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  overlayBadge: { color: '#fff', fontSize: 14, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, overflow: 'hidden', maxWidth: '60%' },
  recordingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(234,67,53,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
  guideBox: { alignSelf: 'center', width: '80%', height: 120, position: 'absolute', top: '40%' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#1a73e8' },
  counterBadge: { position: 'absolute', bottom: 200, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 40 },
  miniList: { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12, padding: 8, marginHorizontal: 16 },
  captureBtn: { backgroundColor: '#1a73e8', width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#fff' },
  stopBtn: { backgroundColor: '#ea4335', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30, flex: 1, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '70%' },
  textItem: { padding: 16, backgroundColor: '#f5f7fa', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  cancelBtn: { marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center' },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  summary: { padding: 20, backgroundColor: '#f5f7fa', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fee', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  actions: { padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  shareBtn: { backgroundColor: '#34a853', paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  newCaptureBtn: { backgroundColor: '#f0f0f0', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
});
