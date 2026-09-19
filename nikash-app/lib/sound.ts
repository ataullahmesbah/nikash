import { Vibration } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// নতুন নোটিফিকেশন/নোটিশ এলে শব্দ + ভাইব্রেশন।
//
// আগে শুধু ফোন কাঁপত — দোকানের শব্দের মধ্যে সেটা টের পাওয়া যায় না।
// এখন ছোট্ট একটা ঘণ্টা বাজে (assets/sounds/notify.wav)।
//
// expo-audio লাগে। কোনো কারণে মডিউলটা না থাকলে (পুরনো node_modules,
// npm install বাকি) অ্যাপ যেন ক্র্যাশ না করে — তাই lazy require + try/catch,
// আর তখন আগের মতো শুধু ভাইব্রেশনই হবে।

const PREF_KEY = "nikash.sound.enabled";

let soundOn = true;
let player: { play: () => void; seekTo: (s: number) => unknown } | null = null;
let loadTried = false;

/** অ্যাপ চালুর সময় একবার — ব্যবহারকারী শব্দ বন্ধ করে রেখেছিল কিনা দেখি */
export async function loadSoundPref() {
  try {
    const v = await AsyncStorage.getItem(PREF_KEY);
    soundOn = v !== "0";
  } catch {
    soundOn = true;
  }
  return soundOn;
}

export function isSoundOn() {
  return soundOn;
}

export async function setSoundOn(on: boolean) {
  soundOn = on;
  try {
    await AsyncStorage.setItem(PREF_KEY, on ? "1" : "0");
  } catch {
    // পছন্দটা সেভ না হলেও এই সেশনে কাজ করবে
  }
  if (on) playNotificationSound();
}

function getPlayer() {
  if (loadTried) return player;
  loadTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const audio = require("expo-audio");
    // ফোন সাইলেন্ট থাকলেও নোটিফিকেশনের শব্দ শোনা দরকার
    audio.setAudioModeAsync?.({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "mixWithOthers",
    })?.catch?.(() => {});
    player = audio.createAudioPlayer(require("../assets/sounds/notify.wav"));
  } catch {
    player = null;
  }
  return player;
}

/**
 * শব্দ + কাঁপুনি একসাথে। শব্দ না বাজলেও কাঁপুনিটা সবসময় হবে, তাই
 * নীরব ফোনেও খবরটা চোখ এড়ায় না।
 */
export function playNotificationSound(pattern: number[] = [0, 160, 80, 160]) {
  try {
    Vibration.vibrate(pattern);
  } catch {
    // কিছু ডিভাইসে ভাইব্রেটর থাকে না
  }

  if (!soundOn) return;

  const p = getPlayer();
  if (!p) return;

  try {
    // পরপর দুটো নোটিফিকেশন এলে শুরু থেকেই যেন আবার বাজে
    const r = p.seekTo(0);
    if (r && typeof (r as Promise<void>).then === "function") {
      (r as Promise<void>).then(() => p.play()).catch(() => {});
    } else {
      p.play();
    }
  } catch {
    // শব্দ না বাজলেও কাঁপুনি তো হয়েই গেছে
  }
}
