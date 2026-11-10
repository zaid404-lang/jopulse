import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// SF Pro is used on Apple devices (see globals.css); Inter is the closest match everywhere else
const body = Inter({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Plant Pulse · Zarqa Line A",
  description: "Energy cost and machine health for an industrial plant in Zarqa, priced on the EMRC medium-industry time-of-use tariff.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
