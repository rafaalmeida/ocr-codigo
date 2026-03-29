import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCapture, CaptureItem } from '../src/context/CaptureContext';
import { recognizeText } from '../src/utils/ocr';
import { inferPattern, findMatchingTexts } from '../src/utils/pattern';
import { CaptureOverlay } from '../src/components/CaptureOverlay';
import { CapturedList } from '../src/components/CapturedList';
import { ConfirmationModal } from '../src/components/ConfirmationModal';

type CaptureMode = 'manual' | 'confirming' | 'auto';

export default function CameraScreen() {
  const router = useRouter();
  const { state, dispatch } = useCapture();
  const cameraRef = useRef<CameraView>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<CaptureMode>('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedTexts, setDetectedTexts] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Clean up auto-capture on unmount
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current);
      }
    };
  }, []);

  const captureAndProcess = useCallback(async (): Promise<string[]> => {
    if (!cameraRef.current || isProcessing) return [];

    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        throw new Error('Falha ao capturar foto');
      }

      const blocks = await recognizeText(photo.base64, state.apiKey);
      const texts = blocks.map(b => b.text).filter(t => t.length > 0);
      return texts;
    } catch (error: any) {
      if (mode === 'manual') {
        Alert.alert('Erro no OCR', error.message || 'Erro desconhecido');
      }
      return [];
    } finally {
      setIsProcessing(false);
    }
  }, [state.apiKey, isProcessing, mode]);

  // Manual capture (first time)
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

  // User confirms a text from the modal
  const handleConfirm = (selectedText: string) => {
    setShowModal(false);

    const pattern = inferPattern(selectedText, state.context);
    dispatch({
      type: 'SET_PATTERN',
      payload: { pattern, example: selectedText },
    });

    // Add the confirmed text as first capture
    dispatch({
      type: 'ADD_CAPTURE',
      payload: {
        id: Date.now().toString(),
        value: selectedText,
        timestamp: new Date(),
      },
    });

    Vibration.vibrate(100);
    setMode('auto');
    startAutoCapture(pattern);
  };

  // Cancel confirmation
  const handleCancelConfirm = () => {
    setShowModal(false);
    setMode('manual');
    setDetectedTexts([]);
  };

  // Start automatic capture loop
  const startAutoCapture = (patternOverride?: typeof state.pattern) => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
    }

    const currentPattern = patternOverride || state.pattern;
    if (!currentPattern) return;

    autoTimerRef.current = setInterval(async () => {
      if (isProcessing) return;

      try {
        const texts = await captureAndProcess();
        if (texts.length === 0) return;

        const matches = findMatchingTexts(texts, currentPattern);
        for (const match of matches) {
          const item: CaptureItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            value: match,
            timestamp: new Date(),
          };
          dispatch({ type: 'ADD_CAPTURE', payload: item });
          Vibration.vibrate(50);
        }
      } catch {
        // Silent fail in auto mode
      }
    }, 2500);
  };

  // Stop capture and go to results
  const handleStop = () => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    router.replace('/results');
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>
          O app precisa de acesso a camera para funcionar.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Permitir Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      >
        <CaptureOverlay
          captureCount={state.captures.length}
          isAutoCapturing={mode === 'auto'}
          context={state.context}
        />
      </CameraView>

      {/* Bottom controls */}
      <View style={styles.bottomContainer}>
        {/* Captured items list */}
        <CapturedList items={state.captures} maxHeight={120} />

        {/* Buttons */}
        <View style={styles.controls}>
          {mode === 'manual' && (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleManualCapture}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.captureButtonText}>Capturar</Text>
              )}
            </TouchableOpacity>
          )}

          {mode === 'auto' && (
            <>
              {isProcessing && (
                <ActivityIndicator
                  color="#1a73e8"
                  size="small"
                  style={styles.autoIndicator}
                />
              )}
              <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <Text style={styles.stopButtonText}>Parar Captura</Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'confirming' && isProcessing && (
            <ActivityIndicator color="#1a73e8" size="large" />
          )}
        </View>
      </View>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showModal}
        texts={detectedTexts}
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 32,
  },
  permissionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 16,
  },
  captureButton: {
    backgroundColor: '#1a73e8',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  stopButton: {
    backgroundColor: '#ea4335',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    flex: 1,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  autoIndicator: {
    marginRight: 8,
  },
});
