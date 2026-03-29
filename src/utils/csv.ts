import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { CaptureItem } from '../context/CaptureContext';

function formatDate(date: Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function generateCSV(items: CaptureItem[], context: string): string {
  const BOM = '\uFEFF';
  const header = 'Indice,Dado Capturado,Data/Hora,Contexto';

  const rows = items.map((item, index) => {
    const idx = String(index + 1);
    const value = escapeCSVField(item.value);
    const date = formatDate(item.timestamp);
    const ctx = escapeCSVField(context);
    return `${idx},${value},${date},${ctx}`;
  });

  return BOM + [header, ...rows].join('\n');
}

export async function saveAndShareCSV(
  items: CaptureItem[],
  context: string
): Promise<void> {
  const csvContent = generateCSV(items, context);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `captura_${timestamp}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: 'Compartilhar capturas',
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    throw new Error('Compartilhamento nao disponivel neste dispositivo');
  }
}

export async function saveCSVToDevice(
  items: CaptureItem[],
  context: string
): Promise<string> {
  const csvContent = generateCSV(items, context);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `captura_${timestamp}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return filePath;
}
