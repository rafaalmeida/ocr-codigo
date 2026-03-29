import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { CaptureItem } from '../context/CaptureContext';

interface CapturedListProps {
  items: CaptureItem[];
  maxHeight?: number;
}

export function CapturedList({ items, maxHeight = 150 }: CapturedListProps) {
  if (items.length === 0) return null;

  const reversedItems = [...items].reverse();

  return (
    <View style={[styles.container, { maxHeight }]}>
      <FlatList
        data={reversedItems}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.item}>
            <Text style={styles.index}>{items.length - index}</Text>
            <Text style={styles.value} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 8,
    marginHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  index: {
    color: '#999',
    fontSize: 12,
    width: 24,
    textAlign: 'right',
  },
  value: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
    flex: 1,
  },
});
