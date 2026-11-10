import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plant Pulse — B2B Industrial Energy & Predictive Maintenance | QRCE Pitch",
  description: "Apple VisionOS-style Dark Glassmorphic Dashboard simulating EMRC time-of-use tariffs, reactive power penalties, and predictive bearing vibration diagnostics for Zarqa Industrial Zone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#05070E] text-white font-[family-name:var(--font-geist-sans)] selection:bg-emerald-500/30 selection:text-emerald-300">
        {children}
      </body>
    </html>
  );
}
