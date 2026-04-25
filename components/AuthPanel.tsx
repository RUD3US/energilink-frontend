import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

export function AuthPanel({
  token,
  busy,
  status,
  title = "Login / Signup",
  onLogin,
  onSignup,
  onLogout,
}: {
  token: string | null;
  busy: "login" | "signup" | "logout" | null;
  status: string;
  title?: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const disabled = busy !== null;

  if (token) {
    return (
      <View style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, gap: 8 }}>
        <Text style={{ fontWeight: "700" }}>Logged in</Text>
        <Text style={{ color: "#555" }}>{status}</Text>

        <Pressable
          disabled={disabled}
          onPress={onLogout}
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#ddd",
            alignItems: "center",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text>{busy === "logout" ? "Logging out..." : "Logout"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ padding: 12, borderWidth: 1, borderColor: "#eee", borderRadius: 12, gap: 8 }}>
      <Text style={{ fontWeight: "700" }}>{title}</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10, backgroundColor: "#fff" }}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="password"
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10, backgroundColor: "#fff" }}
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          disabled={disabled}
          onPress={() => onLogin(email, password)}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "#111",
            alignItems: "center",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {busy === "login" ? "Logging in..." : "Login"}
          </Text>
        </Pressable>

        <Pressable
          disabled={disabled}
          onPress={() => onSignup(email, password)}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "#2563eb",
            alignItems: "center",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            {busy === "signup" ? "Signing up..." : "Signup"}
          </Text>
        </Pressable>
      </View>

      {!!status && (
        <Text style={{ color: status.startsWith("❌") ? "red" : "#555" }}>
          {status}
        </Text>
      )}
    </View>
  );
}
