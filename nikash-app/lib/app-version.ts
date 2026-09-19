import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// অ্যাপের ভার্সন যাচাই।
//
// APK হাতে হাতে বিতরণ হয় (Play Store নয়), তাই নিজে থেকে আপডেট হয় না।
// নতুন ভার্সন বের করলে ব্যবহারকারী যেন জানতে পারে — সেটাই এখানকার কাজ।
//
// দুই রকম:
//   • সাধারণ আপডেট — উপরে ব্যানার, "পরে করব" চাপা যায়
//   • জরুরি আপডেট  — পুরো পর্দা আটকে যায় (force_update, বা চলতি
//     ভার্সনটা min_supported-এর চেয়ে পুরনো হলে)

export type AppVersion = {
    version: string;
    build_number: number;
    apk_url: string;
    release_notes: string | null;
    force_update: boolean;
    min_supported: string | null;
    file_size_mb: number | null;
    released_at: string;
};

export type UpdateCheck = {
    /** নতুন ভার্সন আছে কিনা */
    available: boolean;
    /** আটকে দিতে হবে কিনা */
    mandatory: boolean;
    current: string;
    latest: AppVersion | null;
};

export const currentVersion = (): string =>
    Constants.expoConfig?.version ?? "1.0.0";

/**
 * "1.2.10" বনাম "1.2.9" — সংখ্যা ধরে তুলনা।
 * a < b হলে ঋণাত্মক, সমান হলে ০, a > b হলে ধনাত্মক।
 *
 * টেক্সট হিসেবে তুলনা করলে "1.2.10" < "1.2.9" হয়ে যেত (কারণ '1' < '9'),
 * তাই প্রতিটি অংশ আলাদা করে সংখ্যায় মেলাই। অংশের সংখ্যা কম-বেশি হলে
 * অনুপস্থিত অংশকে ০ ধরি — "1.2" আর "1.2.0" একই।
 */
export function compareVersions(a: string, b: string): number {
    const pa = String(a).split(".");
    const pb = String(b).split(".");
    const len = Math.max(pa.length, pb.length);

    for (let i = 0; i < len; i++) {
        // "1.0.0-beta" এর মতো লেজ থাকলে শুধু সংখ্যাটুকু নিই
        const na = parseInt(pa[i] ?? "0", 10) || 0;
        const nb = parseInt(pb[i] ?? "0", 10) || 0;
        if (na !== nb) return na - nb;
    }
    return 0;
}

/**
 * সার্ভারে সবচেয়ে নতুন ভার্সন কী, আর সেটা এই অ্যাপের চেয়ে নতুন কিনা।
 *
 * নেট না থাকলে বা টেবিল খালি থাকলে চুপচাপ "আপডেট নেই" ধরে নেয় —
 * ভার্সন চেক করতে না পারা কখনোই অ্যাপ আটকানোর কারণ হবে না।
 */
export async function checkForUpdate(): Promise<UpdateCheck> {
    const current = currentVersion();
    const none: UpdateCheck = { available: false, mandatory: false, current, latest: null };

    try {
        const { data, error } = await supabase
            .rpc("latest_app_version", { p_platform: "android" })
            .maybeSingle();

        if (error || !data) return none;

        const latest = data as AppVersion;
        if (!latest.version) return none;

        const isNewer = compareVersions(current, latest.version) < 0;
        if (!isNewer) return none;

        // জরুরি: হয় স্পষ্ট করে force_update, নয়তো চলতি ভার্সনটা আর
        // সমর্থিত নয় (min_supported-এর চেয়ে পুরনো)
        const belowMinimum =
            !!latest.min_supported && compareVersions(current, latest.min_supported) < 0;

        return {
            available: true,
            mandatory: latest.force_update || belowMinimum,
            current,
            latest,
        };
    } catch {
        return none;
    }
}

// কোন ভার্সনের ব্যানারটা ব্যবহারকারী সরিয়ে দিয়েছে — একই ব্যানার
// বারবার দেখিয়ে বিরক্ত করার মানে নেই। জরুরি আপডেটে এটা খাটে না।
const SKIP_KEY = "nikash.update.skipped";

export async function getSkippedVersion(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(SKIP_KEY);
    } catch {
        return null;
    }
}

export async function skipVersion(version: string) {
    try {
        await AsyncStorage.setItem(SKIP_KEY, version);
    } catch {
        // সেভ না হলে পরের বার আবার দেখাবে — ক্ষতি নেই
    }
}
