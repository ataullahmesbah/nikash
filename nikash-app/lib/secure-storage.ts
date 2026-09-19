import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// লগইন টোকেন কোথায় রাখা হবে।
//
// আগে AsyncStorage-এ সাদা টেক্সটে থাকত — ফোন রুট করা থাকলে বা adb backup
// দিয়ে কেউ ফাইলটা পড়ে ফেললে সেই টোকেন দিয়ে অ্যাকাউন্টে ঢুকে পড়তে পারত।
// এখন Android Keystore / iOS Keychain-এ রাখি।
//
// দুটো কাঁটা আছে, দুটোরই ব্যবস্থা নিচে:
//   ১. SecureStore-এ একেকটা মান ২০৪৮ বাইটের বেশি রাখা যায় না, আর
//      Supabase-এর সেশন JSON তার চেয়ে বড় হতে পারে — তাই টুকরো করে রাখি।
//   ২. ওয়েবে SecureStore নেই — সেখানে আগের মতোই AsyncStorage।

const CHUNK_SIZE = 1800; // ২০৪৮-এর নিচে, একটু জায়গা হাতে রেখে
const CHUNK_PREFIX = "__nkchunks:";

let secureOk: boolean | null = null;

async function canUseSecure() {
  if (Platform.OS === "web") return false;
  if (secureOk !== null) return secureOk;
  try {
    secureOk = await SecureStore.isAvailableAsync();
  } catch {
    secureOk = false;
  }
  return secureOk;
}

/** SecureStore-এর চাবিতে শুধু অক্ষর, সংখ্যা আর . _ - চলে */
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

async function secureGet(key: string): Promise<string | null> {
  const head = await SecureStore.getItemAsync(safeKey(key));
  if (head === null) return null;
  if (!head.startsWith(CHUNK_PREFIX)) return head;

  const count = Number(head.slice(CHUNK_PREFIX.length));
  if (!Number.isFinite(count) || count <= 0) return null;

  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    const part = await SecureStore.getItemAsync(`${safeKey(key)}.${i}`);
    // একটা টুকরোও না পেলে জোড়া লাগানো অর্থহীন — নেই ধরে নিই
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join("");
}

async function secureClearChunks(key: string) {
  const head = await SecureStore.getItemAsync(safeKey(key));
  if (head?.startsWith(CHUNK_PREFIX)) {
    const count = Number(head.slice(CHUNK_PREFIX.length));
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${safeKey(key)}.${i}`).catch(() => {});
    }
  }
}

async function secureSet(key: string, value: string) {
  await secureClearChunks(key);

  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(safeKey(key), value);
    return;
  }

  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  for (let i = 0; i < chunks.length; i++) {
    await SecureStore.setItemAsync(`${safeKey(key)}.${i}`, chunks[i]);
  }
  await SecureStore.setItemAsync(safeKey(key), `${CHUNK_PREFIX}${chunks.length}`);
}

async function secureRemove(key: string) {
  await secureClearChunks(key);
  await SecureStore.deleteItemAsync(safeKey(key)).catch(() => {});
}

/**
 * Supabase-এর auth ক্লায়েন্ট এই তিনটে মেথডই ডাকে। কোনোটা ব্যর্থ হলে
 * অ্যাপ যেন ক্র্যাশ না করে — বড়জোর আবার লগইন করতে বলবে।
 */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!(await canUseSecure())) return AsyncStorage.getItem(key);

    try {
      const v = await secureGet(key);
      if (v !== null) return v;

      // আপডেটের আগে যারা লগইন করা ছিল — তাদের সেশন পুরনো জায়গা থেকে
      // তুলে নিরাপদ জায়গায় সরিয়ে দিই, যাতে আবার লগইন করতে না হয়।
      const legacy = await AsyncStorage.getItem(key);
      if (legacy !== null) {
        await secureSet(key, legacy).catch(() => {});
        await AsyncStorage.removeItem(key).catch(() => {});
        return legacy;
      }
      return null;
    } catch {
      return AsyncStorage.getItem(key).catch(() => null);
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!(await canUseSecure())) return AsyncStorage.setItem(key, value);
    try {
      await secureSet(key, value);
    } catch {
      // Keystore কোনো কারণে কাজ না করলে অন্তত লগইনটা টিকে থাকুক
      await AsyncStorage.setItem(key, value).catch(() => {});
    }
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key).catch(() => {});
    if (!(await canUseSecure())) return;
    try {
      await secureRemove(key);
    } catch {
      // মুছতে না পারলেও টোকেনের মেয়াদ শেষ হয়ে যাবে
    }
  },
};
