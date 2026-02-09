import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a2e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#0f0f1a',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'JW Present',
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="create"
          options={{
            title: 'Nuova Presentazione',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="presentation/[id]"
          options={{
            title: 'Presentazione',
          }}
        />
        <Stack.Screen
          name="generate"
          options={{
            title: 'Genera con AI',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="scripture"
          options={{
            title: 'Scrittura',
            presentation: 'modal',
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
