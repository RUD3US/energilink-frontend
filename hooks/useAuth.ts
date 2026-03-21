import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { login, signup } from "../lib/api";

const KEY = "token";

async function storageGet(key: string) {
  try {
    if (Platform.OS === "web") return window.localStorage.getItem(key);
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function storageSet(key: string, value: string) {
  if (Platform.OS === "web") window.localStorage.setItem(key, value);
  else await AsyncStorage.setItem(key, value);
}

async function storageRemove(key: string) {
  if (Platform.OS === "web") window.localStorage.removeItem(key);
  else await AsyncStorage.removeItem(key);
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<"login" | "signup" | "logout" | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    (async () => {
      const t = await storageGet(KEY);
      setToken(t);
      if (t) setStatus("✅ Session restored.");
    })();
  }, []);

  const doLogin = useCallback(async (email: string, password: string) => {
    setBusy("login");
    setStatus("Logging in...");
    try {
      const r = await login(email, password);
      await storageSet(KEY, r.token);
      setToken(r.token);
      setStatus("✅ Logged in.");
      return r.token;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setStatus(`❌ Login failed: ${msg}`);
      throw e;
    } finally {
      setBusy(null);
    }
  }, []);

  const doSignup = useCallback(async (email: string, password: string) => {
    setBusy("signup");
    setStatus("Signing up...");
    try {
      const r = await signup(email, password);
      await storageSet(KEY, r.token);
      setToken(r.token);
      setStatus("✅ Signup successful (logged in).");
      return r.token;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setStatus(`❌ Signup failed: ${msg}`);
      throw e;
    } finally {
      setBusy(null);
    }
  }, []);

  const logout = useCallback(async () => {
    setBusy("logout");
    setStatus("Logging out...");
    try {
      await storageRemove(KEY);
      setToken(null);
      setStatus("Logged out.");
    } finally {
      setBusy(null);
    }
  }, []);

  return { token, busy, status, doLogin, doSignup, logout };
}