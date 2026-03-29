import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCapture } from '../src/context/CaptureContext';
import { saveAndShareCSV } from '../src/utils/csv';

export default function ResultScreen() {
  const router = useRouter();
  const { state, dispatch } = useCapture();

  const handleShare = async () => {
    if (state.captures.length === 0) {
      Alert.alert('Sem dados', 'Nenhum dado capturado para compartilhar.');
      return;
    }

    try {
      await saveAndShareCSV(state.captures, state.context);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao compartilhar arquivo.');
    }
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'REMOVE_CAPTURE', payload: id });
  };

  const handleNewCapture = () => {
    dispatch({ type: 'RESET' });
    router.replace('/');
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>
          {state.captures.length}{' '}
          {state.captures.length === 1 ? 'item capturado' : 'itens capturados'}
        </Text>
        <Text style={styles.summaryContext}>Contexto: {state.context}</Text>
        {state.pattern && (
          <Text style={styles.summaryPattern}>
            Padrao: {state.pattern.description}
          </Text>
        )}
      </View>

      {/* Capture list */}
      {state.captures.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhum dado capturado.</Text>
        </View>
      ) : (
        <FlatList
          data={state.captures}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <Text style={styles.listItemIndex}>{index + 1}</Text>
                <View style={styles.listItemContent}>
                  <Text style={styles.listItemValue}>{item.value}</Text>
                  <Text style={styles.listItemTime}>
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id)}
              >
                <Text style={styles.deleteButtonText}>X</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.shareButton,
            state.captures.length === 0 && styles.buttonDisabled,
          ]}
          onPress={handleShare}
          disabled={state.captures.length === 0}
        >
          <Text style={styles.shareButtonText}>Compartilhar CSV</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.newCaptureButton} onPress={handleNewCapture}>
          <Text style={styles.newCaptureButtonText}>Nova Captura</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  summary: {
    padding: 20,
    backgroundColor: '#f5f7fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  summaryContext: {
    fontSize: 14,
    color: '#666',
  },
  summaryPattern: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  listContent: {
    padding: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  listItemIndex: {
    fontSize: 14,
    color: '#999',
    width: 28,
    textAlign: 'center',
    fontWeight: '600',
  },
  listItemContent: {
    flex: 1,
  },
  listItemValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  listItemTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#ea4335',
    fontSize: 14,
    fontWeight: '700',
  },
  actions: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  shareButton: {
    backgroundColor: '#34a853',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  newCaptureButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  newCaptureButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});
