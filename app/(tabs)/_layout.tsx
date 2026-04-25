import { Link, Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable } from "react-native";

import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useColorScheme } from "@/components/useColorScheme";
import Colors from "@/constants/Colors";
import { useAuth } from "@/hooks/useAuth";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { token } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "EnergiLink",
          tabBarLabel: "Home",
          headerTitle: "EnergiLink",
          tabBarIcon: ({ color, focused }) => (
            <SymbolView
              name={{
                ios: focused ? "bolt.circle.fill" : "bolt.circle",
                android: "bolt",
                web: "bolt",
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
                    name={{ ios: "info.circle", android: "info", web: "info" }}
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
          title: "History Table",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "tablecells",
                android: "table_chart",
                web: "table",
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="gemp-input"
        options={{
          title: "GEMP Input",
          href: token ? "/gemp-input" : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "square.and.pencil",
                android: "edit",
                web: "edit",
              }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="gemp-report"
        options={{
          title: "GEMP Report",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "doc.text",
                android: "description",
                web: "description",
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
