import type { Metadata } from "next";
import { LayoutClient } from "@/components/layout/layout-client";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="antialiased">
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
