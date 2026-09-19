import { PageLoading } from "@/components/ui";

// এই একটা ফাইলই (dashboard) গ্রুপের সব পেজ ঢেকে দেয় — কোম্পানি,
// পেমেন্ট, ফিনান্স, নোটিশ, সেটিংস সবখানে নেভিগেট করলেই সাথে সাথে
// কঙ্কাল দেখা যাবে, সার্ভারের উত্তরের অপেক্ষায় ফাঁকা পর্দা নয়।
export default function DashboardLoading() {
  return <PageLoading />;
}
