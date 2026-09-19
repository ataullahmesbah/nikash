import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "nikash:onboarding-seen";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "true";
  } catch {
    return true; // fail open — never block app entry over a storage read
  }
}

export async function markOnboardingSeen() {
  try {
    await AsyncStorage.setItem(KEY, "true");
  } catch {
    // best-effort
  }
}
