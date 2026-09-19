import { useCallback, useEffect, useState } from "react";
import {
    AppState,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import {
    checkForUpdate,
    getSkippedVersion,
    skipVersion,
    type UpdateCheck,
} from "@/lib/app-version";
import { toBnDigits } from "@/lib/format";
import { theme } from "./ui";

// নতুন ভার্সন এলে ব্যবহারকারীকে জানানো।
//
// APK Play Store-এ নেই, তাই নিজে থেকে আপডেট হয় না — না জানালে মানুষ
// পুরনো ভার্সনেই থেকে যাবে, জরুরি বাগ ফিক্সও পৌঁছাবে না।
//
//   • সাধারণ আপডেট → উপরে ব্যানার, "পরে" চেপে সরানো যায়
//   • জরুরি আপডেট  → পুরো পর্দা আটকে যায়, সরানোর উপায় নেই

export function UpdateGate() {
    const [check, setCheck] = useState<UpdateCheck | null>(null);
    const [hidden, setHidden] = useState(false);

    // এটা রুট লেআউটে বসে, কোনো স্ক্রিনের ভেতরে নয় — তাই useFocusEffect
    // নয়, সাধারণ useEffect। সাথে AppState: ফোন পকেটে রেখে পরদিন আবার
    // খুললেও (অ্যাপ বন্ধ না করে) নতুন ভার্সন ধরা পড়বে।
    const run = useCallback(async () => {
        const result = await checkForUpdate();
        if (!result.available || !result.latest) return;

        // আগে "পরে করব" চেপে থাকলে ওই ভার্সনের ব্যানার আর দেখাব না।
        // জরুরি আপডেটে এই ছাড় নেই।
        if (!result.mandatory) {
            const skipped = await getSkippedVersion();
            if (skipped === result.latest.version) return;
        }

        setCheck(result);
        setHidden(false);
    }, []);

    useEffect(() => {
        run();

        const sub = AppState.addEventListener("change", (state) => {
            if (state === "active") run();
        });
        return () => sub.remove();
    }, [run]);

    if (!check?.latest || hidden) return null;

    const v = check.latest;

    function download() {
        if (!v.apk_url) return;
        Linking.openURL(v.apk_url).catch(() => { });
    }

    async function later() {
        setHidden(true);
        await skipVersion(v.version);
    }

    const sizeText = v.file_size_mb ? ` · ${toBnDigits(String(v.file_size_mb))} MB` : "";

    // ---------- জরুরি: পুরো পর্দা আটকে যায় ----------
    if (check.mandatory) {
        return (
            <Modal visible transparent={false} animationType="fade" onRequestClose={() => { }}>
                <View style={styles.blockWrap}>
                    <ScrollView contentContainerStyle={styles.blockInner}>
                        <Text style={styles.blockIcon}>⬆️</Text>
                        <Text style={styles.blockTitle}>আপডেট করা জরুরি</Text>
                        <Text style={styles.blockBody}>
                            নিকাশের নতুন সংস্করণ এসেছে। পুরনো সংস্করণে হিসাব ভুল হতে পারে, তাই
                            আপডেট না করে এগোনো যাবে না।
                        </Text>

                        <View style={styles.versionRow}>
                            <View style={styles.versionBox}>
                                <Text style={styles.versionLabel}>এখন আছে</Text>
                                <Text style={styles.versionOld}>{toBnDigits(check.current)}</Text>
                            </View>
                            <Text style={styles.arrow}>→</Text>
                            <View style={styles.versionBox}>
                                <Text style={styles.versionLabel}>নতুন</Text>
                                <Text style={styles.versionNew}>{toBnDigits(v.version)}</Text>
                            </View>
                        </View>

                        {v.release_notes ? (
                            <View style={styles.notes}>
                                <Text style={styles.notesTitle}>এই সংস্করণে</Text>
                                <Text style={styles.notesBody}>{v.release_notes}</Text>
                            </View>
                        ) : null}

                        <Pressable style={styles.blockBtn} onPress={download}>
                            <Text style={styles.blockBtnText}>ডাউনলোড করুন{sizeText}</Text>
                        </Pressable>

                        <Text style={styles.blockHint}>
                            ডাউনলোড শেষে ফাইলটি খুলে ইনস্টল করুন। আপনার হিসাবের কোনো তথ্য মুছবে না।
                        </Text>
                    </ScrollView>
                </View>
            </Modal>
        );
    }

    // ---------- সাধারণ: উপরে ব্যানার ----------
    return (
        <View style={styles.banner}>
            <Text style={styles.bannerIcon}>🎉</Text>
            <View style={{ flex: 1 }}>
                <Text style={styles.bannerTitle}>নতুন সংস্করণ {toBnDigits(v.version)} এসেছে</Text>
                {v.release_notes ? (
                    <Text style={styles.bannerBody} numberOfLines={2}>
                        {v.release_notes}
                    </Text>
                ) : null}
            </View>
            <View style={{ gap: 6 }}>
                <Pressable style={styles.bannerBtn} onPress={download} hitSlop={6}>
                    <Text style={styles.bannerBtnText}>আপডেট</Text>
                </Pressable>
                <Pressable onPress={later} hitSlop={6}>
                    <Text style={styles.bannerLater}>পরে</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // জরুরি
    blockWrap: { flex: 1, backgroundColor: theme.surface },
    blockInner: { flexGrow: 1, justifyContent: "center", padding: 28, gap: 14 },
    blockIcon: { fontSize: 52, textAlign: "center" },
    blockTitle: { fontSize: 23, fontWeight: "800", color: theme.text, textAlign: "center" },
    blockBody: {
        fontSize: 14,
        color: theme.textMuted,
        textAlign: "center",
        lineHeight: 22,
    },
    versionRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        marginVertical: 6,
    },
    versionBox: { alignItems: "center", gap: 3 },
    versionLabel: { fontSize: 11, color: theme.textFaint },
    versionOld: { fontSize: 17, fontWeight: "700", color: theme.textMuted },
    versionNew: { fontSize: 17, fontWeight: "800", color: theme.success },
    arrow: { fontSize: 18, color: theme.textFaint },
    notes: {
        backgroundColor: theme.bg,
        borderRadius: 14,
        padding: 14,
        gap: 6,
    },
    notesTitle: { fontSize: 12, fontWeight: "700", color: theme.textMuted },
    notesBody: { fontSize: 13, color: theme.text, lineHeight: 20 },
    blockBtn: {
        backgroundColor: theme.primary,
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: "center",
        marginTop: 4,
    },
    blockBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
    blockHint: {
        fontSize: 12,
        color: theme.textFaint,
        textAlign: "center",
        lineHeight: 18,
    },

    // সাধারণ ব্যানার
    banner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 13,
        borderRadius: 14,
        backgroundColor: theme.infoBg,
        borderWidth: 1,
        borderColor: "#bae6fd",
    },
    bannerIcon: { fontSize: 20 },
    bannerTitle: { fontSize: 13.5, fontWeight: "700", color: theme.text },
    bannerBody: { fontSize: 12, color: theme.textMuted, marginTop: 2, lineHeight: 17 },
    bannerBtn: {
        backgroundColor: theme.primary,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 7,
    },
    bannerBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
    bannerLater: { fontSize: 11.5, color: theme.textMuted, textAlign: "center" },
});
