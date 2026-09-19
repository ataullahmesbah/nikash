import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 18 }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: "#0f172a" }}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: "ড্যাশবোর্ড", tabBarIcon: () => <TabIcon label="📊" /> }}
      />
      <Tabs.Screen
        name="sales"
        options={{ title: "বিক্রয়", tabBarIcon: () => <TabIcon label="🧾" /> }}
      />
      <Tabs.Screen
        name="purchases"
        options={{ title: "ক্রয়", tabBarIcon: () => <TabIcon label="🛒" /> }}
      />
      <Tabs.Screen
        name="parties"
        options={{ title: "পার্টি", tabBarIcon: () => <TabIcon label="👥" /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "আরও", tabBarIcon: () => <TabIcon label="⚙️" /> }}
      />
      <Tabs.Screen name="products" options={{ href: null }} />
    </Tabs>
  );
}
