import { Stack } from 'expo-router';
import { CaptureProvider } from '../src/context/CaptureContext';

export default function RootLayout() {
  return (
    <CaptureProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a73e8' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'OCR Captura' }}
        />
        <Stack.Screen
          name="camera"
          options={{
            title: 'Captura',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="results"
          options={{ title: 'Resultados' }}
        />
      </Stack>
    </CaptureProvider>
  );
}
