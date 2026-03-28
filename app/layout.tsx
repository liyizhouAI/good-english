import type { Metadata } from "next";
import { Lora, JetBrains_Mono } from "next/font/google";
import { LayoutClient } from "@/components/layout/layout-client";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Good English - 好英语",
  description:
    "好英语，通过刻意练习，让你像播客嘉宾一样侃侃而谈，流利、深刻而温暖人心。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${lora.variable} ${mono.variable}`}>
      <body className="antialiased">
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
