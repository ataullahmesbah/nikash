import type { Metadata } from "next";
import { Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali", "latin"],
});

export const metadata: Metadata = {
  title: "Nikash — স্টক, বাকি ও লাভের হিসাব",
  description: "সরবরাহকারী, গুদাম ও দোকানের জন্য ব্যবসা ব্যবস্থাপনা সিস্টেম",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={`${notoBengali.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
