import { Link, Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Pressable } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
  name="index"
  options={{
    title: 'EnergiLink',
    tabBarLabel: 'Home',
    headerTitle: 'EnergiLink',
    tabBarIcon: ({ color, focused }) => (
      <SymbolView
        name={{
          ios: focused ? 'bolt.circle.fill' : 'bolt.circle',
          android: 'bolt',
          web: 'bolt',
        }}
        tintColor={color}
        size={30}
      />
    ),

          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable style={{ marginRight: 15 }}>
                {({ pressed }) => (
                  <SymbolView
                    name={{ ios: 'info.circle', android: 'info', web: 'info' }}
                    size={25}
                    tintColor={Colors[colorScheme].text}
                    style={{ opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="table"
        options={{
          title: 'History Table',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: 'tablecells',
                android: 'table_chart',
                web: 'table'
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}