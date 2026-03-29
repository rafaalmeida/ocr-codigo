import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

interface ConfirmationModalProps {
  visible: boolean;
  texts: string[];
  onConfirm: (selectedText: string) => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  visible,
  texts,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Textos Detectados</Text>
          <Text style={styles.subtitle}>
            Selecione o dado que deseja capturar:
          </Text>

          <ScrollView style={styles.listContainer}>
            {texts.length === 0 ? (
              <Text style={styles.emptyText}>
                Nenhum texto detectado. Tente novamente.
              </Text>
            ) : (
              texts.map((text, index) => (
                <TouchableOpacity
                  key={`${text}-${index}`}
                  style={styles.textItem}
                  onPress={() => onConfirm(text)}
                >
                  <Text style={styles.textItemLabel}>{text}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancelar e Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '70%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  listContainer: {
    maxHeight: 300,
  },
  textItem: {
    padding: 16,
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textItemLabel: {
    fontSize: 16,
    color: '#1a73e8',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  cancelButton: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
});
